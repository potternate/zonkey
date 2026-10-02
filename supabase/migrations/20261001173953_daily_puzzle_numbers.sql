update public.games
set puzzle_number = (puzzle_date - date '2026-09-30') + 1
where mode = 'daily'
  and puzzle_number is distinct from (puzzle_date - date '2026-09-30') + 1;
