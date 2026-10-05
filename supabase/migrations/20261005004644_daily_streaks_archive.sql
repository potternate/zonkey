create unique index games_one_archive_per_player
on public.games (player_id, puzzle_date)
where mode = 'practice' and puzzle_date is not null;

create or replace function public.player_scores(p_player_id text, p_daily_date date)
returns jsonb
language sql stable
set search_path = public
as $$
  with owned as (
    select * from public.games where player_id = p_player_id
  ), completed as (
    select * from owned where status in ('won', 'lost') and completed_at is not null
  ), streak_dates as (
    select distinct puzzle_date
    from completed
    where mode = 'daily' and puzzle_date <= p_daily_date
      and (completed_at at time zone 'UTC')::date = puzzle_date
  ), streak_islands as (
    select puzzle_date,
      puzzle_date - (row_number() over (order by puzzle_date))::integer as island
    from streak_dates
  ), streak_runs as (
    select count(*) as length, max(puzzle_date) as last_date
    from streak_islands group by island
  ), scored as (
    select completed.*,
      case when mode = 'daily' then 'daily'
        when mode = 'practice' and puzzle_number is not null then 'archive'
        else 'unlimited' end as score_mode
    from completed
  ), modes as (
    select score_mode as mode,
      count(*) as played,
      count(*) filter (where status = 'won') as wins,
      min(final_rounds) filter (where status = 'won') as best_rounds,
      round(avg(final_rounds) filter (where status = 'won'), 1) as average_rounds
    from scored group by score_mode
  ), stats as (
    select mode, jsonb_build_object(
      'played', played,
      'wins', wins,
      'winRate', round(wins * 100.0 / played),
      'bestRounds', best_rounds,
      'averageRounds', average_rounds
    ) as value from modes
  ), ranked_recent as (
    select scored.*,
      row_number() over (
        partition by score_mode
        order by completed_at desc, id desc
      ) as mode_rank
    from scored
  ), recent as (
    select * from ranked_recent where mode_rank <= 10
  ), saved_dailies as (
    select distinct on (puzzle_date) *
    from owned
    where mode in ('daily', 'practice') and puzzle_date <= p_daily_date
      and puzzle_number is not null
    order by puzzle_date, case when mode = 'daily' then 0 else 1 end, id desc
  )
  select jsonb_build_object(
    'dailyDate', p_daily_date,
    'dailyGame', (
      select jsonb_build_object('id', id, 'status', status)
      from owned where mode = 'daily' and puzzle_date = p_daily_date
    ),
    'dailyStreak', jsonb_build_object(
      'current', coalesce((select length from streak_runs where last_date >= p_daily_date - 1), 0),
      'best', coalesce((select max(length) from streak_runs), 0)
    ),
    'daily', coalesce(
      (select value from stats where mode = 'daily'),
      '{"played":0,"wins":0,"winRate":0,"bestRounds":null,"averageRounds":null}'::jsonb
    ),
    'unlimited', coalesce(
      (select value from stats where mode = 'unlimited'),
      '{"played":0,"wins":0,"winRate":0,"bestRounds":null,"averageRounds":null}'::jsonb
    ),
    'archive', coalesce(
      (select value from stats where mode = 'archive'),
      '{"played":0,"wins":0,"winRate":0,"bestRounds":null,"averageRounds":null}'::jsonb
    ),
    'savedDailies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'date', puzzle_date,
        'puzzleNumber', puzzle_number,
        'status', status,
        'rounds', case when status = 'active' then round_number - 1
          else coalesce(final_rounds, round_number) end
      ) order by puzzle_date desc) from saved_dailies
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'mode', mode,
        'puzzleNumber', puzzle_number,
        'status', status,
        'rounds', final_rounds,
        'completedAt', completed_at
      ) order by completed_at desc, id desc) from recent
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.player_scores(text, date) from public, anon, authenticated;
grant execute on function public.player_scores(text, date) to service_role;