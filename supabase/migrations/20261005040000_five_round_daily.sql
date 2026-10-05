create table public.daily_puzzles (
  puzzle_date date primary key,
  puzzle_number integer not null unique check (puzzle_number > 0),
  pairs jsonb not null check (jsonb_typeof(pairs) = 'array' and jsonb_array_length(pairs) = 5)
);

create table public.daily_runs (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  puzzle_date date not null references public.daily_puzzles,
  puzzle_number integer not null,
  mode text not null check (mode in ('daily', 'archive')),
  status text not null default 'active' check (status in ('active', 'completed')),
  current_round integer not null default 1 check (current_round between 1 and 5),
  score integer not null default 0 check (score between 0 and 5000 and score % 200 = 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (player_id, puzzle_date)
);

create table public.daily_rounds (
  run_id uuid not null references public.daily_runs on delete cascade,
  round_number integer not null check (round_number between 1 and 5),
  guess_number integer not null default 1 check (guess_number between 1 and 5),
  word_a text not null,
  word_b text not null,
  ai_answer text,
  status text not null default 'active' check (status in ('active', 'won', 'lost')),
  score integer not null default 0 check (score between 0 and 1000 and score % 200 = 0),
  primary key (run_id, round_number)
);

create table public.daily_guesses (
  run_id uuid not null,
  round_number integer not null,
  guess_number integer not null check (guess_number between 1 and 5),
  word_a text not null,
  word_b text not null,
  player_answer text not null,
  ai_answer text not null,
  matched boolean not null,
  created_at timestamptz not null default now(),
  primary key (run_id, round_number, guess_number),
  foreign key (run_id, round_number) references public.daily_rounds on delete cascade
);

create table public.daily_ai_answers (
  puzzle_date date not null references public.daily_puzzles,
  round_number integer not null check (round_number between 1 and 5),
  guess_number integer not null check (guess_number between 1 and 5),
  word_a text not null,
  word_b text not null,
  answer text not null,
  primary key (puzzle_date, round_number, guess_number, word_a, word_b)
);

create index daily_runs_completed_idx on public.daily_runs (puzzle_date, score)
where status = 'completed' and mode = 'daily';

alter table public.daily_puzzles enable row level security;
alter table public.daily_runs enable row level security;
alter table public.daily_rounds enable row level security;
alter table public.daily_guesses enable row level security;
alter table public.daily_ai_answers enable row level security;
revoke all on public.daily_puzzles, public.daily_runs, public.daily_rounds, public.daily_guesses, public.daily_ai_answers from anon, authenticated;
grant all on public.daily_puzzles, public.daily_runs, public.daily_rounds, public.daily_guesses, public.daily_ai_answers to service_role;

create function public.start_daily_run(p_player_id text, p_date date, p_number integer, p_pairs jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_pairs jsonb;
  v_created boolean;
begin
  if p_date < date '2026-09-30' or p_date > (now() at time zone 'UTC')::date
    or p_number <> p_date - date '2026-09-30' + 1 then
    raise exception 'Invalid Daily date' using errcode = '22023';
  end if;
  insert into public.daily_puzzles (puzzle_date, puzzle_number, pairs)
  values (p_date, p_number, p_pairs) on conflict (puzzle_date) do nothing;
  select pairs into v_pairs from public.daily_puzzles where puzzle_date = p_date;
  insert into public.daily_runs (player_id, puzzle_date, puzzle_number, mode)
  values (p_player_id, p_date, p_number, case when p_date = (now() at time zone 'UTC')::date then 'daily' else 'archive' end)
  on conflict (player_id, puzzle_date) do nothing returning id into v_id;
  v_created := v_id is not null;
  if v_id is null then
    select id into v_id from public.daily_runs where player_id = p_player_id and puzzle_date = p_date;
  else
    insert into public.daily_rounds (run_id, round_number, word_a, word_b)
    select v_id, ordinal::integer, pair->>'a', pair->>'b'
    from jsonb_array_elements(v_pairs) with ordinality as pairs(pair, ordinal);
  end if;
  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

create function public.commit_daily_answer(p_id uuid, p_player_id text, p_round integer, p_guess integer, p_answer text)
returns text language plpgsql set search_path = public as $$
declare
  g public.daily_runs;
  r public.daily_rounds;
  v_answer text;
begin
  select * into g from public.daily_runs where id = p_id for update;
  if not found or g.player_id <> p_player_id then return 'not_found'; end if;
  select * into r from public.daily_rounds where run_id = g.id and round_number = p_round;
  if g.status <> 'active' or g.current_round <> p_round or r.guess_number <> p_guess then return 'conflict'; end if;
  insert into public.daily_ai_answers (puzzle_date, round_number, guess_number, word_a, word_b, answer)
  values (g.puzzle_date, p_round, p_guess, r.word_a, r.word_b, p_answer)
  on conflict do nothing;
  select answer into v_answer from public.daily_ai_answers
  where puzzle_date = g.puzzle_date and round_number = p_round and guess_number = p_guess
    and word_a = r.word_a and word_b = r.word_b;
  update public.daily_rounds set ai_answer = v_answer
  where run_id = g.id and round_number = p_round and ai_answer is null;
  return 'ok';
end;
$$;

create function public.submit_daily_guess(
  p_id uuid, p_player_id text, p_round integer, p_guess integer,
  p_answer text, p_exact_answer text, p_semantic_matched boolean, p_board_attempts bigint
) returns table (code text, reveal jsonb)
language plpgsql set search_path = public as $$
declare
  g public.daily_runs;
  r public.daily_rounds;
  v_matched boolean;
  v_score integer;
  v_board_key text;
  v_attempts bigint;
begin
  select * into g from public.daily_runs where id = p_id for update;
  if not found or g.player_id <> p_player_id then
    return query select 'not_found'::text, null::jsonb; return;
  end if;
  select * into r from public.daily_rounds where run_id = g.id and round_number = p_round;
  if g.status <> 'active' or g.current_round <> p_round or r.guess_number <> p_guess then
    return query select 'conflict'::text, null::jsonb; return;
  end if;
  if r.ai_answer is null then
    return query select 'ai_not_ready'::text, null::jsonb; return;
  end if;
  if p_guess = 1 then
    v_board_key := 'daily-v2:' || g.puzzle_date::text || ':' || p_round::text;
    perform pg_advisory_xact_lock(hashtextextended(v_board_key, 0));
    select coalesce(sum(count), 0) into v_attempts from public.first_guesses where board_key = v_board_key;
    if p_board_attempts is null or v_attempts <> p_board_attempts then
      return query select 'board_changed'::text, null::jsonb; return;
    end if;
    insert into public.first_guesses (board_key, word, count) values (v_board_key, p_answer, 1)
    on conflict (board_key, word) do update set count = public.first_guesses.count + 1;
  end if;
  v_matched := p_answer = r.ai_answer or p_exact_answer = r.ai_answer
    or (p_guess > 1 and coalesce(p_semantic_matched, false));
  insert into public.daily_guesses (run_id, round_number, guess_number, word_a, word_b, player_answer, ai_answer, matched)
  values (g.id, p_round, p_guess, r.word_a, r.word_b, p_answer, r.ai_answer, v_matched);
  if v_matched or p_guess = 5 then
    v_score := case when v_matched then (6 - p_guess) * 200 else 0 end;
    update public.daily_rounds set status = case when v_matched then 'won' else 'lost' end,
      score = v_score, ai_answer = null where run_id = g.id and round_number = p_round;
    update public.daily_runs set score = score + v_score,
      current_round = least(p_round + 1, 5),
      status = case when p_round = 5 then 'completed' else 'active' end,
      completed_at = case when p_round = 5 then now() else null end where id = g.id;
  else
    update public.daily_rounds set guess_number = p_guess + 1, word_a = p_answer,
      word_b = r.ai_answer, ai_answer = null where run_id = g.id and round_number = p_round;
  end if;
  return query select 'ok'::text, jsonb_build_object(
    'guess_number', p_guess, 'word_a', r.word_a, 'word_b', r.word_b,
    'player_answer', p_answer, 'ai_answer', r.ai_answer, 'matched', v_matched
  );
end;
$$;

create function public.daily_run_summary(p_player_id text, p_today date)
returns jsonb language sql stable set search_path = public as $$
  with owned as (
    select * from public.daily_runs where player_id = p_player_id and puzzle_date <= p_today
  ), dates as (
    select puzzle_date from owned where mode = 'daily' and status = 'completed'
      and (completed_at at time zone 'UTC')::date = puzzle_date
    union
    select puzzle_date from public.games where player_id = p_player_id and mode = 'daily'
      and status in ('won', 'lost') and puzzle_date <= p_today
      and (completed_at at time zone 'UTC')::date = puzzle_date
  ), islands as (
    select puzzle_date, puzzle_date - (row_number() over (order by puzzle_date))::integer as island from dates
  ), runs as (
    select count(*) as length, max(puzzle_date) as last_date from islands group by island
  )
  select jsonb_build_object(
    'history', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'date', puzzle_date, 'puzzleNumber', puzzle_number, 'mode', mode,
      'status', status, 'score', score, 'completedAt', completed_at
    ) order by puzzle_date desc) from owned), '[]'::jsonb),
    'streak', jsonb_build_object(
      'current', coalesce((select length from runs where last_date >= p_today - 1), 0),
      'best', coalesce((select max(length) from runs), 0)
    )
  );
$$;

create function public.daily_score_results(p_id uuid, p_player_id text)
returns jsonb language sql stable set search_path = public as $$
  with yours as (
    select * from public.daily_runs where id = p_id and player_id = p_player_id
      and status = 'completed' and mode = 'daily'
  ), completed as (
    select r.* from public.daily_runs r join yours y on r.puzzle_date = y.puzzle_date
    where r.status = 'completed' and r.mode = 'daily'
  ), peers as (
    select c.* from completed c join yours y on c.id <> y.id
  )
  select case when exists (select 1 from yours) then jsonb_build_object(
    'distribution', (select jsonb_agg(jsonb_build_object(
      'score', bucket, 'count', (select count(*) from completed where score = bucket)
    ) order by bucket) from generate_series(0, 5000, 200) as bucket),
    'totalPlayers', (select count(*) from completed),
    'betterThanPercent', case when exists (select 1 from peers) then (
      select floor(count(*) filter (where p.score < y.score) * 100.0 / count(*))
      from peers p cross join yours y
    ) else null end
  ) else null end;
$$;

revoke all on function public.start_daily_run(text, date, integer, jsonb),
  public.commit_daily_answer(uuid, text, integer, integer, text),
  public.submit_daily_guess(uuid, text, integer, integer, text, text, boolean, bigint),
  public.daily_run_summary(text, date), public.daily_score_results(uuid, text) from public, anon, authenticated;
grant execute on function public.start_daily_run(text, date, integer, jsonb),
  public.commit_daily_answer(uuid, text, integer, integer, text),
  public.submit_daily_guess(uuid, text, integer, integer, text, text, boolean, bigint),
  public.daily_run_summary(text, date), public.daily_score_results(uuid, text) to service_role;
