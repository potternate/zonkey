create index games_daily_completed_idx
on public.games (puzzle_date, status, final_rounds) include (id)
where mode = 'daily' and status in ('won', 'lost') and completed_at is not null;

create or replace function public.daily_results(p_game_id uuid, p_player_id text)
returns jsonb
language sql stable
set search_path = public
as $$
  with owned as (
    select puzzle_date, status, final_rounds
    from public.games
    where id = p_game_id and player_id = p_player_id and mode = 'daily'
      and status in ('won', 'lost') and completed_at is not null
      and final_rounds between 1 and 8
  ), completed as (
    select g.id, g.status, g.final_rounds
    from public.games g join owned o on g.puzzle_date = o.puzzle_date
    where g.mode = 'daily' and g.status in ('won', 'lost')
      and g.completed_at is not null and g.final_rounds between 1 and 8
  ), counts as (
    select count(*) as total,
      count(*) filter (where status = 'lost') as failed,
      count(*) filter (
        where id <> p_game_id and (select status from owned) = 'won'
          and (status = 'lost' or final_rounds > (select final_rounds from owned))
      ) as worse
    from completed
  ), buckets as (
    select n as rounds,
      (select count(*) from completed where status = 'won' and final_rounds = n) as count
    from generate_series(1, 8) n
  )
  select case when exists (select 1 from owned) then jsonb_build_object(
    'distribution', (select jsonb_agg(jsonb_build_object('rounds', rounds, 'count', count) order by rounds) from buckets),
    'failed', failed,
    'totalPlayers', total,
    'betterThanPercent', case when total > 1 then floor(worse * 100.0 / (total - 1)) else null end
  ) else null end
  from counts;
$$;

revoke all on function public.daily_results(uuid, text) from public, anon, authenticated;
grant execute on function public.daily_results(uuid, text) to service_role;
