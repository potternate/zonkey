create table public.ai_usage_windows (
  scope text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (scope, window_started_at)
);

create index ai_usage_windows_started_at_idx on public.ai_usage_windows (window_started_at);

alter table public.ai_usage_windows enable row level security;

create or replace function public.consume_ai_quota(
  p_player_id text,
  p_player_limit integer,
  p_global_limit integer
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_player_scope text := 'player:' || p_player_id;
  v_player_count integer;
  v_global_count integer;
begin
  if p_player_limit < 1 or p_global_limit < 1 then
    return false;
  end if;

  insert into public.ai_usage_windows (scope, window_started_at)
  values ('global', v_window), (v_player_scope, v_window)
  on conflict do nothing;

  select request_count into v_global_count
  from public.ai_usage_windows
  where scope = 'global' and window_started_at = v_window
  for update;

  select request_count into v_player_count
  from public.ai_usage_windows
  where scope = v_player_scope and window_started_at = v_window
  for update;

  if v_global_count >= p_global_limit or v_player_count >= p_player_limit then
    return false;
  end if;

  update public.ai_usage_windows
  set request_count = request_count + 1
  where window_started_at = v_window and scope in ('global', v_player_scope);

  delete from public.ai_usage_windows where window_started_at < now() - interval '7 days';
  return true;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(text, integer, integer) to service_role;

drop function public.submit_judged_answer(uuid, text, integer, text, integer, boolean);

create function public.submit_judged_answer(
  p_game_id uuid,
  p_player_id text,
  p_round_number integer,
  p_answer text,
  p_exact_answer text,
  p_board_attempts bigint,
  p_max_rounds integer,
  p_semantic_matched boolean
) returns table (out_result text, out_matched boolean, out_status text, out_ai_answer text)
language plpgsql
set search_path = public
as $$
declare
  g public.games;
  r public.rounds;
  v_matched boolean;
  v_status text;
  v_board_key text;
  v_board_attempts bigint;
begin
  select * into g from public.games where id = p_game_id for update;
  if not found then
    return query select 'not_found'::text, null::boolean, null::text, null::text;
    return;
  end if;
  if g.player_id <> p_player_id then
    return query select 'forbidden'::text, null::boolean, null::text, null::text;
    return;
  end if;
  if g.status <> 'active' then
    return query select 'not_active'::text, null::boolean, g.status, null::text;
    return;
  end if;
  if g.round_number <> p_round_number then
    return query select 'wrong_round'::text, null::boolean, g.status, null::text;
    return;
  end if;

  select * into r from public.rounds
  where game_id = g.id and round_number = p_round_number for update;
  if not found or r.ai_answer is null then
    return query select 'ai_not_ready'::text, null::boolean, g.status, null::text;
    return;
  end if;
  if r.player_answer is not null then
    return query select 'already_submitted'::text, null::boolean, g.status, null::text;
    return;
  end if;

  if p_round_number = 1 then
    v_board_key := case when g.mode = 'daily' then 'daily:' || g.puzzle_date::text
      else 'unlimited:' || g.start_word_a || '|' || g.start_word_b end;
    perform pg_advisory_xact_lock(hashtextextended(v_board_key, 0));
    if p_board_attempts is not null then
      select coalesce(sum(count), 0) into v_board_attempts
      from public.first_guesses where board_key = v_board_key;
      if v_board_attempts <> p_board_attempts then
        return query select 'board_changed'::text, null::boolean, g.status, null::text;
        return;
      end if;
    end if;
    insert into public.first_guesses (board_key, word, count)
    values (v_board_key, p_answer, 1)
    on conflict (board_key, word)
    do update set count = public.first_guesses.count + 1;
  end if;

  v_matched := p_answer = r.ai_answer or p_exact_answer = r.ai_answer
    or (p_round_number > 1 and coalesce(p_semantic_matched, false));
  update public.rounds set player_answer = p_answer, matched = v_matched where id = r.id;

  if v_matched then
    v_status := 'won';
  elsif p_round_number >= p_max_rounds then
    v_status := 'lost';
  else
    v_status := 'active';
  end if;

  if v_status = 'active' then
    update public.games set round_number = p_round_number + 1 where id = g.id;
    insert into public.rounds (game_id, round_number, word_a, word_b)
    values (g.id, p_round_number + 1, p_answer, r.ai_answer);
  else
    update public.games
    set status = v_status, completed_at = now(), final_rounds = p_round_number
    where id = g.id;
  end if;

  return query select 'ok'::text, v_matched, v_status, r.ai_answer;
end;
$$;

revoke all on function public.submit_judged_answer(uuid, text, integer, text, text, bigint, integer, boolean)
from public, anon, authenticated;
grant execute on function public.submit_judged_answer(uuid, text, integer, text, text, bigint, integer, boolean)
to service_role;

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
  ), ranked_recent as (
    select completed.*,
      row_number() over (
        partition by case when mode = 'daily' then 'daily' else 'unlimited' end
        order by completed_at desc, id desc
      ) as mode_rank
    from completed
  ), recent as (
    select * from ranked_recent where mode_rank <= 10
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
