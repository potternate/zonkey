-- Converts every scored mode from five rounds to three. Rounds 4–5 are preserved in private archive tables.
-- Callers that still send five opening words keep working during rollout; only the first three are stored.

create function public.scored_first_three(p_words jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(word order by ordinal), '[]'::jsonb)
  from jsonb_array_elements(p_words) with ordinality as words(word, ordinal) where ordinal <= 3;
$$;

create table public.scored_five_round_runs as
  select id as run_id, opening_words, status, current_round, score, completed_at from public.scored_runs;
create table public.scored_five_round_puzzles as
  select puzzle_date, opening_words from public.scored_puzzles;
create table public.scored_five_round_rounds as
  select * from public.scored_rounds where round_number > 3;
create table public.scored_five_round_guesses as
  select * from public.scored_guesses where round_number > 3;
create table public.scored_five_round_ai_answers as
  select * from public.scored_ai_answers where round_number > 3;

alter table public.scored_five_round_runs add primary key (run_id);
alter table public.scored_five_round_puzzles add primary key (puzzle_date);
alter table public.scored_five_round_rounds add primary key (run_id, round_number);
alter table public.scored_five_round_guesses add primary key (run_id, round_number, guess_number);
alter table public.scored_five_round_ai_answers add primary key (puzzle_date, round_number, guess_number, word_a, word_b);
alter table public.scored_five_round_runs enable row level security;
alter table public.scored_five_round_puzzles enable row level security;
alter table public.scored_five_round_rounds enable row level security;
alter table public.scored_five_round_guesses enable row level security;
alter table public.scored_five_round_ai_answers enable row level security;
revoke all on public.scored_five_round_runs, public.scored_five_round_puzzles, public.scored_five_round_rounds,
  public.scored_five_round_guesses, public.scored_five_round_ai_answers from anon, authenticated;
grant all on public.scored_five_round_runs, public.scored_five_round_puzzles, public.scored_five_round_rounds,
  public.scored_five_round_guesses, public.scored_five_round_ai_answers to service_role;

alter table public.scored_puzzles drop constraint scored_puzzles_opening_words_check;
alter table public.scored_runs drop constraint scored_runs_opening_words_check;
alter table public.scored_runs drop constraint scored_runs_current_round_check;
alter table public.scored_runs drop constraint scored_runs_score_check;
alter table public.scored_rounds drop constraint scored_rounds_round_number_check;
alter table public.scored_ai_answers drop constraint scored_ai_answers_round_number_check;

delete from public.scored_guesses where round_number > 3;
delete from public.scored_rounds where round_number > 3;
delete from public.scored_ai_answers where round_number > 3;

update public.scored_puzzles set opening_words = public.scored_first_three(opening_words);

with converted as (
  select r.run_id, sum(r.score)::integer as score,
    bool_and(r.status <> 'active') as finished,
    (select max(g.created_at) from public.scored_guesses g where g.run_id = r.run_id) as finished_at
  from public.scored_rounds r group by r.run_id
)
update public.scored_runs s set
  opening_words = public.scored_first_three(s.opening_words),
  score = c.score,
  current_round = least(s.current_round, 3),
  status = case when c.finished then 'completed' else 'active' end,
  completed_at = case when not c.finished then null
    when s.status = 'completed' and s.current_round <= 3 then s.completed_at
    else coalesce(c.finished_at, s.completed_at, now()) end
from converted c where c.run_id = s.id;

alter table public.scored_puzzles add constraint scored_puzzles_opening_words_check
  check (jsonb_typeof(opening_words) = 'array' and jsonb_array_length(opening_words) = 3);
alter table public.scored_runs add constraint scored_runs_opening_words_check
  check (jsonb_typeof(opening_words) = 'array' and jsonb_array_length(opening_words) = 3);
alter table public.scored_runs add constraint scored_runs_current_round_check check (current_round between 1 and 3);
alter table public.scored_runs add constraint scored_runs_score_check check (score between 0 and 3000 and score % 200 = 0);
alter table public.scored_rounds add constraint scored_rounds_round_number_check check (round_number between 1 and 3);
alter table public.scored_ai_answers add constraint scored_ai_answers_round_number_check check (round_number between 1 and 3);

create or replace function public.seed_scored_puzzle(p_date date, p_number integer, p_opening_words jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if p_date is null or p_number is null or p_date < date '2026-09-30'
    or p_date > (now() at time zone 'UTC')::date or p_number <> p_date - date '2026-09-30' + 1 then
    raise exception 'Invalid Daily date' using errcode = '22023';
  end if;
  if p_opening_words is null or jsonb_typeof(p_opening_words) <> 'array'
    or jsonb_array_length(p_opening_words) < 3 then
    raise exception 'A game needs three opening words' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_opening_words) w
    where jsonb_typeof(w) <> 'string' or (w #>> '{}') !~ '^[a-z]+(-[a-z]+)*$') then
    raise exception 'Invalid opening word' using errcode = '22023';
  end if;
  insert into public.scored_puzzles (puzzle_date, puzzle_number, opening_words)
  values (p_date, p_number, public.scored_first_three(p_opening_words)) on conflict (puzzle_date) do nothing;
end;
$$;

create or replace function public.start_scored_run(
  p_player_id text, p_date date, p_number integer, p_opening_words jsonb, p_theme text default null, p_request_id uuid default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_words jsonb := public.scored_first_three(p_opening_words);
  v_created boolean;
begin
  if p_opening_words is null or jsonb_typeof(p_opening_words) <> 'array'
    or jsonb_array_length(p_opening_words) < 3 then
    raise exception 'A game needs three opening words' using errcode = '22023';
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

create or replace function public.submit_scored_guess(
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
    update public.scored_runs set score = score + v_score, current_round = least(p_round + 1, 3),
      status = case when p_round = 3 then 'completed' else 'active' end,
      completed_at = case when p_round = 3 then now() else null end where id = g.id;
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

create or replace function public.scored_daily_results(p_id uuid, p_player_id text)
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
    ) order by bucket) from generate_series(0, 3000, 200) as bucket),
    'totalPlayers', (select count(*) from completed),
    'betterThanPercent', case when exists (select 1 from peers) then (
      select floor(count(*) filter (where p.score < y.score) * 100.0 / count(*))
      from peers p cross join yours y
    ) else null end
  ) else null end;
$$;

revoke all on function public.scored_first_three(jsonb) from public, anon, authenticated;
grant execute on function public.scored_first_three(jsonb) to service_role;
