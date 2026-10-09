alter table public.daily_puzzles add column opening_words jsonb
  check (opening_words is null or (jsonb_typeof(opening_words) = 'array' and jsonb_array_length(opening_words) = 5));
alter table public.games add column player_first boolean not null default false
  check (not player_first or mode = 'unlimited');

create or replace function public.start_daily_run(p_player_id text, p_date date, p_number integer, p_pairs jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_pairs jsonb;
  v_words jsonb;
  v_created boolean;
begin
  if p_date < date '2026-09-30' or p_date > (now() at time zone 'UTC')::date
    or p_number <> p_date - date '2026-09-30' + 1 then
    raise exception 'Invalid Daily date' using errcode = '22023';
  end if;
  insert into public.daily_puzzles (puzzle_date, puzzle_number, pairs)
  values (p_date, p_number, p_pairs) on conflict (puzzle_date) do nothing;
  select pairs, opening_words into v_pairs, v_words from public.daily_puzzles where puzzle_date = p_date;
  insert into public.daily_runs (player_id, puzzle_date, puzzle_number, mode)
  values (p_player_id, p_date, p_number, case when p_date = (now() at time zone 'UTC')::date then 'daily' else 'archive' end)
  on conflict (player_id, puzzle_date) do nothing returning id into v_id;
  v_created := v_id is not null;
  if v_id is null then
    select id into v_id from public.daily_runs where player_id = p_player_id and puzzle_date = p_date;
  else
    insert into public.daily_rounds (run_id, round_number, word_a, word_b, ai_answer)
    select v_id, ordinal::integer,
      case when v_words is null then pair->>'a' else '' end,
      case when v_words is null then pair->>'b' else '' end,
      v_words->>(ordinal::integer - 1)
    from jsonb_array_elements(v_pairs) with ordinality as pairs(pair, ordinal);
  end if;
  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

create function public.start_player_first_daily(
  p_player_id text, p_date date, p_number integer, p_pairs jsonb, p_opening_words jsonb
) returns jsonb language plpgsql set search_path = public as $$
begin
  if p_opening_words is null or jsonb_typeof(p_opening_words) <> 'array'
    or jsonb_array_length(p_opening_words) <> 5 then
    raise exception 'A Daily needs five opening words' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_opening_words) w
    where jsonb_typeof(w) <> 'string' or (w #>> '{}') !~ '^[a-z]+(-[a-z]+)*$') then
    raise exception 'Invalid opening word' using errcode = '22023';
  end if;
  insert into public.daily_puzzles (puzzle_date, puzzle_number, pairs, opening_words)
  values (p_date, p_number, p_pairs, p_opening_words) on conflict (puzzle_date) do nothing;
  return public.start_daily_run(p_player_id, p_date, p_number, p_pairs);
end;
$$;

create function public.create_player_first_game(p_player_id text, p_opening_word text, p_theme text default null)
returns public.games language plpgsql set search_path = public as $$
declare g public.games;
begin
  if p_opening_word is null or p_opening_word !~ '^[a-z]+(-[a-z]+)*$' then
    raise exception 'Invalid opening word' using errcode = '22023';
  end if;
  select * into g from public.create_game(p_player_id, 'unlimited', null, null, '', '');
  update public.games set player_first = true, theme = p_theme where id = g.id returning * into g;
  update public.rounds set ai_answer = p_opening_word where game_id = g.id and round_number = 1;
  return g;
end;
$$;

revoke all on function public.start_player_first_daily(text, date, integer, jsonb, jsonb),
  public.create_player_first_game(text, text, text) from public, anon, authenticated;
grant execute on function public.start_player_first_daily(text, date, integer, jsonb, jsonb),
  public.create_player_first_game(text, text, text) to service_role;
