alter table public.games drop constraint games_mode_check;
alter table public.games add constraint games_mode_check check (mode in ('daily', 'unlimited', 'practice'));

create or replace function public.player_scores(p_player_id text, p_daily_date date)
returns jsonb
language sql stable
set search_path = public
as $$
  with owned as (
    select * from public.games where player_id = p_player_id
  ), completed as (
    select * from owned where status in ('won', 'lost') and completed_at is not null
  ), modes as (
    select case when mode = 'daily' then 'daily' else 'unlimited' end as mode,
      count(*) as played,
      count(*) filter (where status = 'won') as wins,
      min(final_rounds) filter (where status = 'won') as best_rounds,
      round(avg(final_rounds) filter (where status = 'won'), 1) as average_rounds
    from completed group by case when mode = 'daily' then 'daily' else 'unlimited' end
  ), stats as (
    select mode, jsonb_build_object(
      'played', played,
      'wins', wins,
      'winRate', round(wins * 100.0 / played),
      'bestRounds', best_rounds,
      'averageRounds', average_rounds
    ) as value from modes
  ), recent as (
    select * from completed order by completed_at desc, id desc limit 10
  )
  select jsonb_build_object(
    'dailyDate', p_daily_date,
    'dailyGame', (
      select jsonb_build_object('id', id, 'status', status)
      from owned where mode = 'daily' and puzzle_date = p_daily_date
    ),
    'daily', coalesce(
      (select value from stats where mode = 'daily'),
      '{"played":0,"wins":0,"winRate":0,"bestRounds":null,"averageRounds":null}'::jsonb
    ),
    'unlimited', coalesce(
      (select value from stats where mode = 'unlimited'),
      '{"played":0,"wins":0,"winRate":0,"bestRounds":null,"averageRounds":null}'::jsonb
    ),
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
