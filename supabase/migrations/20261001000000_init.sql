-- Zonkey schema. All access goes through the Next.js server using the
-- service role key; RLS is enabled with no policies so anon/authenticated
-- clients can't read or write anything directly.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  mode text not null default 'daily' check (mode in ('daily', 'practice')),
  puzzle_date date,
  puzzle_number integer,
  start_word_a text not null,
  start_word_b text not null,
  status text not null default 'active' check (status in ('active', 'won', 'lost')),
  round_number integer not null default 1 check (round_number >= 1),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  final_rounds integer,
  constraint games_daily_has_date check (mode <> 'daily' or puzzle_date is not null)
);

create unique index games_one_daily_per_player on public.games (player_id, puzzle_date) where mode = 'daily';
create index games_player_started_idx on public.games (player_id, started_at desc);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  word_a text not null,
  word_b text not null,
  player_answer text,
  ai_answer text,
  matched boolean,
  created_at timestamptz not null default now(),
  unique (game_id, round_number)
);

create table public.events (
  id bigint generated always as identity primary key,
  name text not null,
  player_id text,
  game_id uuid references public.games (id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_name_created_idx on public.events (name, created_at desc);

alter table public.games enable row level security;
alter table public.rounds enable row level security;
alter table public.events enable row level security;

-- Creates a game and its first round atomically.
create or replace function public.create_game(
  p_player_id text,
  p_mode text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_word_a text,
  p_word_b text
) returns setof public.games
language plpgsql
set search_path = public
as $$
declare
  g public.games;
begin
  insert into public.games (player_id, mode, puzzle_date, puzzle_number, start_word_a, start_word_b)
  values (p_player_id, p_mode, p_puzzle_date, p_puzzle_number, p_word_a, p_word_b)
  returning * into g;

  insert into public.rounds (game_id, round_number, word_a, word_b)
  values (g.id, 1, p_word_a, p_word_b);

  return next g;
end;
$$;

-- Validates and applies a player's answer in one transaction. Mirrors
-- resolveSubmission() in src/lib/game/engine.ts. p_answer must already be
-- normalized by the server.
create or replace function public.submit_answer(
  p_game_id uuid,
  p_player_id text,
  p_round_number integer,
  p_answer text,
  p_max_rounds integer
) returns table (out_result text, out_matched boolean, out_status text, out_ai_answer text)
language plpgsql
set search_path = public
as $$
declare
  g public.games;
  r public.rounds;
  v_matched boolean;
  v_status text;
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
  where game_id = g.id and round_number = p_round_number
  for update;
  if not found or r.ai_answer is null then
    return query select 'ai_not_ready'::text, null::boolean, g.status, null::text;
    return;
  end if;
  if r.player_answer is not null then
    return query select 'already_submitted'::text, null::boolean, g.status, null::text;
    return;
  end if;

  v_matched := p_answer = r.ai_answer;
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

revoke all on function public.create_game(text, text, date, integer, text, text) from public, anon, authenticated;
revoke all on function public.submit_answer(uuid, text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.create_game(text, text, date, integer, text, text) to service_role;
grant execute on function public.submit_answer(uuid, text, integer, text, integer) to service_role;
