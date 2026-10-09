create table public.scored_puzzles (
  puzzle_date date primary key,
  puzzle_number integer not null unique check (puzzle_number > 0),
  opening_words jsonb not null check (jsonb_typeof(opening_words) = 'array' and jsonb_array_length(opening_words) = 5)
);

create table public.scored_runs (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  puzzle_date date references public.scored_puzzles,
  puzzle_number integer,
  mode text not null check (mode in ('daily', 'archive', 'unlimited')),
  theme text check (theme in ('animals', 'food', 'outdoors')),
  opening_words jsonb not null check (jsonb_typeof(opening_words) = 'array' and jsonb_array_length(opening_words) = 5),
  status text not null default 'active' check (status in ('active', 'completed')),
  current_round integer not null default 1 check (current_round between 1 and 5),
  score integer not null default 0 check (score between 0 and 5000 and score % 200 = 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (player_id, puzzle_date),
  check ((mode = 'unlimited' and puzzle_date is null and puzzle_number is null)
    or (mode <> 'unlimited' and puzzle_date is not null and puzzle_number is not null and theme is null))
);

create table public.scored_rounds (
  run_id uuid not null references public.scored_runs on delete cascade,
  round_number integer not null check (round_number between 1 and 5),
  guess_number integer not null default 1 check (guess_number between 1 and 5),
  word_a text not null default '',
  word_b text not null default '',
  ai_answer text,
  status text not null default 'active' check (status in ('active', 'won', 'lost')),
  score integer not null default 0 check (score between 0 and 1000 and score % 200 = 0),
  primary key (run_id, round_number)
);

create table public.scored_guesses (
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
  foreign key (run_id, round_number) references public.scored_rounds on delete cascade
);

create table public.scored_ai_answers (
  puzzle_date date not null references public.scored_puzzles,
  round_number integer not null check (round_number between 1 and 5),
  guess_number integer not null check (guess_number between 1 and 5),
  word_a text not null,
  word_b text not null,
  answer text not null,
  primary key (puzzle_date, round_number, guess_number, word_a, word_b)
);

create index scored_runs_player_idx on public.scored_runs (player_id, started_at desc);
create index scored_runs_completed_idx on public.scored_runs (puzzle_date, score)
  where status = 'completed' and mode = 'daily';

alter table public.scored_puzzles enable row level security;
alter table public.scored_runs enable row level security;
alter table public.scored_rounds enable row level security;
alter table public.scored_guesses enable row level security;
alter table public.scored_ai_answers enable row level security;
revoke all on public.scored_puzzles, public.scored_runs, public.scored_rounds, public.scored_guesses, public.scored_ai_answers from anon, authenticated;
grant all on public.scored_puzzles, public.scored_runs, public.scored_rounds, public.scored_guesses, public.scored_ai_answers to service_role;

insert into public.scored_puzzles (puzzle_date, puzzle_number, opening_words)
select puzzle_date, puzzle_number, opening_words from public.daily_puzzles where opening_words is not null;

create function public.seed_scored_puzzle(p_date date, p_number integer, p_opening_words jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if p_date is null or p_number is null or p_date < date '2026-09-30'
    or p_date > (now() at time zone 'UTC')::date or p_number <> p_date - date '2026-09-30' + 1 then
    raise exception 'Invalid Daily date' using errcode = '22023';
  end if;
  if p_opening_words is null or jsonb_typeof(p_opening_words) <> 'array'
    or jsonb_array_length(p_opening_words) <> 5 then
    raise exception 'A game needs five opening words' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_opening_words) w
    where jsonb_typeof(w) <> 'string' or (w #>> '{}') !~ '^[a-z]+(-[a-z]+)*$') then
    raise exception 'Invalid opening word' using errcode = '22023';
  end if;
  insert into public.scored_puzzles (puzzle_date, puzzle_number, opening_words)
  values (p_date, p_number, p_opening_words) on conflict (puzzle_date) do nothing;
end;
$$;

create function public.start_scored_run(
  p_player_id text, p_date date, p_number integer, p_opening_words jsonb, p_theme text default null, p_request_id uuid default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_words jsonb := p_opening_words;
  v_created boolean;
begin
  if p_opening_words is null or jsonb_typeof(p_opening_words) <> 'array'
    or jsonb_array_length(p_opening_words) <> 5 then
    raise exception 'A game needs five opening words' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_opening_words) w
    where jsonb_typeof(w) <> 'string' or (w #>> '{}') !~ '^[a-z]+(-[a-z]+)*$') then
    raise exception 'Invalid opening word' using errcode = '22023';
  end if;
  if p_date is not null then
    if p_request_id is not null then raise exception 'Daily has no request ID' using errcode = '22023'; end if;
    perform public.seed_scored_puzzle(p_date, p_number, p_opening_words);
    select opening_words into v_words from public.scored_puzzles where puzzle_date = p_date;
  elsif p_number is not null then
    raise exception 'Unlimited has no puzzle number' using errcode = '22023';
  end if;
  insert into public.scored_runs (id, player_id, puzzle_date, puzzle_number, mode, opening_words, theme)
  values (coalesce(p_request_id, gen_random_uuid()), p_player_id, p_date, p_number,
    case when p_date is null then 'unlimited' when p_date = (now() at time zone 'UTC')::date then 'daily' else 'archive' end,
    v_words, p_theme)
  on conflict do nothing returning id into v_id;
  v_created := v_id is not null;
  if v_id is null then
    select id into v_id from public.scored_runs where player_id = p_player_id
      and (puzzle_date = p_date or (p_date is null and mode = 'unlimited' and id = p_request_id));
    if v_id is null then raise exception 'Invalid game start' using errcode = '22023'; end if;
  else
    insert into public.scored_rounds (run_id, round_number, ai_answer)
    select v_id, ordinal::integer, word #>> '{}'
    from jsonb_array_elements(v_words) with ordinality as words(word, ordinal);
  end if;
  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

create function public.commit_scored_answer(p_id uuid, p_player_id text, p_round integer, p_guess integer, p_answer text)
returns text language plpgsql set search_path = public as $$
declare
  g public.scored_runs;
  r public.scored_rounds;
  v_answer text := p_answer;
begin
  select * into g from public.scored_runs where id = p_id for update;
  if not found or g.player_id <> p_player_id then return 'not_found'; end if;
  select * into r from public.scored_rounds where run_id = g.id and round_number = p_round;
  if g.status <> 'active' or g.current_round <> p_round or r.guess_number <> p_guess then return 'conflict'; end if;
  if p_guess = 1 then
    v_answer := g.opening_words ->> (p_round - 1);
  elsif g.mode <> 'unlimited' then
    insert into public.scored_ai_answers (puzzle_date, round_number, guess_number, word_a, word_b, answer)
    values (g.puzzle_date, p_round, p_guess, r.word_a, r.word_b, p_answer) on conflict do nothing;
    select answer into v_answer from public.scored_ai_answers
    where puzzle_date = g.puzzle_date and round_number = p_round and guess_number = p_guess
      and word_a = r.word_a and word_b = r.word_b;
  end if;
  update public.scored_rounds set ai_answer = v_answer
  where run_id = g.id and round_number = p_round and ai_answer is null;
  return 'ok';
end;
$$;

create function public.submit_scored_guess(
  p_id uuid, p_player_id text, p_round integer, p_guess integer,
  p_answer text, p_exact_answer text, p_semantic_matched boolean, p_board_attempts bigint
) returns table (code text, reveal jsonb) language plpgsql set search_path = public as $$
declare
  g public.scored_runs;
  r public.scored_rounds;
  v_matched boolean;
  v_score integer;
  v_board_key text;
  v_attempts bigint;
begin
  select * into g from public.scored_runs where id = p_id for update;
  if not found or g.player_id <> p_player_id then
    return query select 'not_found'::text, null::jsonb; return;
  end if;
  select * into r from public.scored_rounds where run_id = g.id and round_number = p_round;
  if g.status <> 'active' or g.current_round <> p_round or r.guess_number <> p_guess then
    return query select 'conflict'::text, null::jsonb; return;
  end if;
  if r.ai_answer is null then
    return query select 'ai_not_ready'::text, null::jsonb; return;
  end if;
  if p_guess = 1 then
    v_board_key := case when g.mode = 'unlimited' then 'unlimited-v3:'
      else 'daily-v3:' || g.puzzle_date::text || ':' end || p_round::text;
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
  insert into public.scored_guesses (run_id, round_number, guess_number, word_a, word_b, player_answer, ai_answer, matched)
  values (g.id, p_round, p_guess, r.word_a, r.word_b, p_answer, r.ai_answer, v_matched);
  if v_matched or p_guess = 5 then
    v_score := case when v_matched then (6 - p_guess) * 200 else 0 end;
    update public.scored_rounds set status = case when v_matched then 'won' else 'lost' end,
      score = v_score, ai_answer = null where run_id = g.id and round_number = p_round;
    update public.scored_runs set score = score + v_score, current_round = least(p_round + 1, 5),
      status = case when p_round = 5 then 'completed' else 'active' end,
      completed_at = case when p_round = 5 then now() else null end where id = g.id;
  else
    update public.scored_rounds set guess_number = p_guess + 1, word_a = p_answer,
      word_b = r.ai_answer, ai_answer = null where run_id = g.id and round_number = p_round;
  end if;
  return query select 'ok'::text, jsonb_build_object(
    'guess_number', p_guess, 'word_a', r.word_a, 'word_b', r.word_b,
    'player_answer', p_answer, 'ai_answer', r.ai_answer, 'matched', v_matched
  );
end;
$$;

create function public.scored_run_summary(p_player_id text, p_today date)
returns jsonb language sql stable set search_path = public as $$
  with owned as (
    select * from public.scored_runs where player_id = p_player_id
      and coalesce(puzzle_date, (started_at at time zone 'UTC')::date) <= p_today
  ), round_totals as (
    select r.run_id, count(*) filter (where r.status = 'won') as solved_rounds,
      coalesce(sum(r.guess_number) filter (where r.status = 'won'), 0) as solved_guesses
    from public.scored_rounds r join owned o on o.id = r.run_id group by r.run_id
  ), dates as (
    select puzzle_date from owned where mode = 'daily' and status = 'completed'
      and (completed_at at time zone 'UTC')::date = puzzle_date
    union
    select puzzle_date from public.daily_runs where player_id = p_player_id and mode = 'daily'
      and status = 'completed' and puzzle_date <= p_today
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
      'id', o.id, 'date', coalesce(o.puzzle_date, (o.started_at at time zone 'UTC')::date),
      'puzzleNumber', o.puzzle_number, 'mode', o.mode, 'theme', o.theme,
      'status', o.status, 'score', o.score, 'completedAt', o.completed_at,
      'solvedRounds', coalesce(t.solved_rounds, 0), 'solvedGuesses', coalesce(t.solved_guesses, 0)
    ) order by o.started_at desc, o.id) from owned o left join round_totals t on t.run_id = o.id), '[]'::jsonb),
    'streak', jsonb_build_object(
      'current', coalesce((select length from runs where last_date >= p_today - 1), 0),
      'best', coalesce((select max(length) from runs), 0)
    )
  );
$$;

create function public.scored_daily_results(p_id uuid, p_player_id text)
returns jsonb language sql stable set search_path = public as $$
  with yours as (
    select * from public.scored_runs where id = p_id and player_id = p_player_id
      and status = 'completed' and mode = 'daily'
  ), completed as (
    select r.* from public.scored_runs r join yours y on r.puzzle_date = y.puzzle_date
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

revoke all on function public.seed_scored_puzzle(date, integer, jsonb),
  public.start_scored_run(text, date, integer, jsonb, text, uuid),
  public.commit_scored_answer(uuid, text, integer, integer, text),
  public.submit_scored_guess(uuid, text, integer, integer, text, text, boolean, bigint),
  public.scored_run_summary(text, date), public.scored_daily_results(uuid, text) from public, anon, authenticated;
grant execute on function public.seed_scored_puzzle(date, integer, jsonb),
  public.start_scored_run(text, date, integer, jsonb, text, uuid),
  public.commit_scored_answer(uuid, text, integer, integer, text),
  public.submit_scored_guess(uuid, text, integer, integer, text, text, boolean, bigint),
  public.scored_run_summary(text, date), public.scored_daily_results(uuid, text) to service_role;
