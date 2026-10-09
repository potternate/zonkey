create or replace function public.daily_run_summary(p_player_id text, p_today date)
returns jsonb language sql stable set search_path = public as $$
  with owned as (
    select * from public.daily_runs where player_id = p_player_id and puzzle_date <= p_today
  ), round_totals as (
    select r.run_id,
      count(*) filter (where r.status = 'won') as solved_rounds,
      coalesce(sum(r.guess_number) filter (where r.status = 'won'), 0) as solved_guesses
    from public.daily_rounds r join owned o on o.id = r.run_id
    group by r.run_id
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
      'id', o.id, 'date', o.puzzle_date, 'puzzleNumber', o.puzzle_number, 'mode', o.mode,
      'status', o.status, 'score', o.score, 'completedAt', o.completed_at,
      'solvedRounds', coalesce(t.solved_rounds, 0), 'solvedGuesses', coalesce(t.solved_guesses, 0)
    ) order by o.puzzle_date desc) from owned o left join round_totals t on t.run_id = o.id), '[]'::jsonb),
    'streak', jsonb_build_object(
      'current', coalesce((select length from runs where last_date >= p_today - 1), 0),
      'best', coalesce((select max(length) from runs), 0)
    )
  );
$$;
