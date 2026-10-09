alter table public.games add column theme text
  check (theme is null or (mode = 'unlimited' and theme in ('animals', 'food', 'outdoors')));

create function public.create_themed_game(
  p_player_id text, p_mode text, p_puzzle_date date, p_puzzle_number integer,
  p_word_a text, p_word_b text, p_theme text
) returns public.games language plpgsql set search_path = public as $$
declare g public.games;
begin
  if p_mode <> 'unlimited' or p_theme is null or p_theme not in ('animals', 'food', 'outdoors') then
    raise exception 'Invalid Unlimited theme';
  end if;
  select * into g from public.create_game(p_player_id, p_mode, p_puzzle_date, p_puzzle_number, p_word_a, p_word_b);
  update public.games set theme = p_theme where id = g.id returning * into g;
  return g;
end;
$$;

revoke all on function public.create_themed_game(text, text, date, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_themed_game(text, text, date, integer, text, text, text) to service_role;
