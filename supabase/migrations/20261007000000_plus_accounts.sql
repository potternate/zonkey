create table public.player_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  player_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.plus_purchases (
  checkout_session_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  payment_intent_id text not null unique,
  amount integer not null check (amount = 500),
  currency text not null check (currency = 'usd'),
  livemode boolean not null,
  created_at timestamptz not null default now()
);

create index plus_purchases_user_idx on public.plus_purchases (user_id);
alter table public.player_accounts enable row level security;
alter table public.plus_purchases enable row level security;
revoke all on public.player_accounts, public.plus_purchases from anon, authenticated;
grant all on public.player_accounts, public.plus_purchases to service_role;

create function public.link_player_account(p_user_id uuid, p_player_id uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  v_player_id uuid;
begin
  select player_id into v_player_id from public.player_accounts where user_id = p_user_id;
  if found then return v_player_id; end if;

  insert into public.player_accounts (user_id, player_id)
  values (p_user_id, p_player_id) on conflict do nothing;

  select player_id into v_player_id from public.player_accounts where user_id = p_user_id;
  if found then return v_player_id; end if;

  insert into public.player_accounts (user_id, player_id)
  values (p_user_id, gen_random_uuid()) on conflict (user_id) do nothing;
  select player_id into v_player_id from public.player_accounts where user_id = p_user_id;
  return v_player_id;
end;
$$;

revoke all on function public.link_player_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_player_account(uuid, uuid) to service_role;
