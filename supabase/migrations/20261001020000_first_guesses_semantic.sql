create table public.first_guesses (
  board_key text not null,
  word text not null,
  count bigint not null default 1 check (count >= 1),
  primary key (board_key, word)
);

alter table public.first_guesses enable row level security;

insert into public.first_guesses (board_key, word, count)
select
  case when g.mode = 'daily' then 'daily:' || g.puzzle_date::text
    else 'unlimited:' || g.start_word_a || '|' || g.start_word_b end,
  r.player_answer,
  count(*)
from public.rounds r join public.games g on g.id = r.game_id
where r.round_number = 1 and r.player_answer is not null
group by 1, 2;

create or replace function public.first_guess_board(p_board_key text)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'attempts', coalesce((select sum(count) from public.first_guesses where board_key = p_board_key), 0),
    'guesses', coalesce((
      select jsonb_agg(jsonb_build_object('word', word, 'count', count) order by count desc, word)
      from (
        select word, count from public.first_guesses
        where board_key = p_board_key order by count desc, word limit 200
      ) guesses
    ), '[]'::jsonb)
  );
$$;

create or replace function public.submit_judged_answer(
  p_game_id uuid,
  p_player_id text,
  p_round_number integer,
  p_answer text,
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

  v_matched := p_answer = r.ai_answer or (p_round_number > 1 and coalesce(p_semantic_matched, false));
  update public.rounds set player_answer = p_answer, matched = v_matched where id = r.id;

  if p_round_number = 1 then
    v_board_key := case when g.mode = 'daily' then 'daily:' || g.puzzle_date::text
      else 'unlimited:' || g.start_word_a || '|' || g.start_word_b end;
    insert into public.first_guesses (board_key, word, count)
    values (v_board_key, p_answer, 1)
    on conflict (board_key, word) do update set count = public.first_guesses.count + 1;
  end if;

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

revoke all on function public.first_guess_board(text) from public, anon, authenticated;
revoke all on function public.submit_judged_answer(uuid, text, integer, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.first_guess_board(text) to service_role;
grant execute on function public.submit_judged_answer(uuid, text, integer, text, integer, boolean) to service_role;
