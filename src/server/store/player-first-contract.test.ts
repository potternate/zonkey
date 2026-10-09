import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { dailyPairsForPuzzle } from "@/lib/game/daily-run";
import { puzzleNumberForDate, toIsoDate } from "@/lib/game/daily";
import { firstGuessBoardKey } from "@/lib/game/first-guesses";
import { toGameView } from "@/lib/game/view";
import { presetOpeningWords } from "../opening-words";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import { DailyMemoryStore } from "./daily-memory-store";
import { toDailyView } from "./daily-types";
import type { GameStore } from "./types";

vi.mock("server-only", () => ({}));
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const container = process.env.SUPABASE_TEST_DB_CONTAINER;
const browserKeys = [process.env.SUPABASE_TEST_ANON_KEY, process.env.SUPABASE_TEST_AUTHENTICATED_KEY];
const stores: [string, () => GameStore][] = [["memory", () => new MemoryStore()]];
if (url && key) stores.push(["supabase", () => new SupabaseStore(url, key)]);

for (const [name, makeStore] of stores) {
  describe(`preset word persistence: ${name}`, () => {
    it("commits and hides the opening, then advances and counts first words only once", async () => {
      const store = makeStore();
      const playerId = crypto.randomUUID();
      const game = await store.createGame({
        playerId, mode: "unlimited", puzzleDate: null, puzzleNumber: null,
        wordA: "", wordB: "", openingWord: "zebra", theme: "animals",
      });
      const restored = (await store.getGame(game.id))!;
      expect(restored).toMatchObject({ playerFirst: true, theme: "animals" });
      const rounds = await store.getRounds(game.id);
      expect(rounds[0].aiAnswer).toBe("zebra");
      const view = toGameView(restored, rounds, 8);
      expect(view.current).toMatchObject({ wordA: "", wordB: "", opening: true, ready: true });
      expect(JSON.stringify(view)).not.toContain("zebra");
      expect(view.startPair).toBeNull();
      const board = await store.getFirstGuesses(firstGuessBoardKey(game));
      const input = {
        gameId: game.id, playerId, roundNumber: 1, answer: "donkey", exactAnswer: "donkey",
        semanticMatched: false, maxRounds: 8, boardAttempts: board.attempts,
      };
      const submitted = await store.submitAnswer(input);
      expect(submitted).toMatchObject({ ok: true, matched: false, status: "active" });
      expect(await store.submitAnswer(input)).toMatchObject({ ok: false });
      expect(await store.getFirstGuesses(firstGuessBoardKey(game))).toMatchObject({ attempts: board.attempts + 1 });
      expect((await store.getRounds(game.id))[1]).toMatchObject({ wordA: "donkey", wordB: "zebra" });
    });
  });
}

describe("Daily definition compatibility", () => {
  it("keeps the first published format and words, regardless of later start parameters", async () => {
    const store = new DailyMemoryStore();
    const starts = await Promise.all(["zebra", "elephant"].map((word) =>
      store.start(crypto.randomUUID(), "2026-09-30", 1, [word, "mountain", "coffee", "ocean", "moon"]),
    ));
    expect(starts[0].run.openingWords).toEqual(starts[1].run.openingWords);
    expect(JSON.stringify(toDailyView(starts[1].run))).not.toContain("zebra");
    const first = await store.start(crypto.randomUUID(), "2026-10-01", 2, presetOpeningWords(5));
    const another = await store.start(crypto.randomUUID(), "2026-10-01", 2, presetOpeningWords(5));
    expect(another.run.openingWords).toEqual(first.run.openingWords);
    expect(toDailyView(another.run).rounds[0].startPair).toBeNull();
  });

  it("selects valid distinct words from the catalog and the selected theme", () => {
    for (const theme of [undefined, "animals", "food", "outdoors"] as const) {
      const words = presetOpeningWords(5, theme);
      expect(new Set(words).size).toBe(5);
      for (const word of words) expect(word).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
    expect(presetOpeningWords(1365).every((word) => /^[a-z]+(-[a-z]+)*$/.test(word))).toBe(true);
  });
});

describe.skipIf(!container)("Daily SQL opening contract", () => {
  it("reuses canonical words, scores five opening matches, and rolls back the fixture", () => {
    const date = toIsoDate(new Date());
    const number = puzzleNumberForDate(date);
    const pairs = JSON.stringify(dailyPairsForPuzzle(number)).replaceAll("'", "''");
    execFileSync("docker", ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: `
        begin;
        select public.start_daily_run('${crypto.randomUUID()}', '${date}', ${number}, '${pairs}'::jsonb);
        update public.daily_puzzles set opening_words = '["zebra","mountain","coffee","ocean","moon"]'
          where puzzle_date = '${date}';
        do $$
        declare
          v_player text := '${crypto.randomUUID()}';
          v_id uuid;
          v_word text;
          v_code text;
          v_board bigint;
        begin
          v_id := (public.start_player_first_daily(v_player, '${date}', ${number}, '${pairs}'::jsonb,
            '["elephant","mountain","coffee","ocean","moon"]'::jsonb)->>'id')::uuid;
          if not exists (select 1 from public.daily_rounds where run_id = v_id
            and round_number = 1 and word_a = '' and word_b = '' and ai_answer = 'zebra') then
            raise exception 'Opening was not committed from the canonical definition';
          end if;
          for n in 1..5 loop
            select ai_answer into v_word from public.daily_rounds where run_id = v_id and round_number = n;
            v_board := (public.first_guess_board('daily-v2:${date}:' || n)->>'attempts')::bigint;
            select code into v_code from public.submit_daily_guess(v_id, v_player, n, 1, v_word, v_word, false, v_board);
            if v_code <> 'ok' then raise exception 'Opening submission failed'; end if;
          end loop;
          if not exists (select 1 from public.daily_runs where id = v_id and score = 5000 and status = 'completed') then
            raise exception 'Opening matches did not score correctly';
          end if;
        end;
        $$;
        rollback;`,
      stdio: ["pipe", "pipe", "pipe"],
    });
  });
});

describe.skipIf(!url || browserKeys.some((browserKey) => !browserKey))("preset word database permissions", () => {
  it.each(browserKeys)("denies browser-role RPCs and private definitions", async (browserKey) => {
    const db = createClient(url!, browserKey!, { auth: { persistSession: false } });
    expect((await db.from("daily_puzzles").select("opening_words")).error?.code).toBe("42501");
    expect((await db.rpc("start_player_first_daily", {
      p_player_id: crypto.randomUUID(), p_date: "2026-09-30", p_number: 1, p_pairs: [],
      p_opening_words: ["zebra", "mountain", "coffee", "ocean", "moon"],
    })).error?.code).toBe("42501");
    expect((await db.rpc("create_player_first_game", {
      p_player_id: crypto.randomUUID(), p_opening_word: "zebra", p_theme: null,
    })).error?.code).toBe("42501");
    for (const table of ["scored_puzzles", "scored_runs", "scored_rounds", "scored_guesses", "scored_ai_answers"]) {
      expect((await db.from(table).select("*")).error?.code).toBe("42501");
    }
    const playerId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const words = ["zebra", "mountain", "coffee", "ocean", "moon"];
    expect((await db.rpc("seed_scored_puzzle", {
      p_date: "2026-09-30", p_number: 1, p_opening_words: words,
    })).error?.code).toBe("42501");
    expect((await db.rpc("start_scored_run", {
      p_player_id: playerId, p_date: null, p_number: null, p_opening_words: words, p_theme: "animals",
    })).error?.code).toBe("42501");
    expect((await db.rpc("commit_scored_answer", {
      p_id: id, p_player_id: playerId, p_round: 1, p_guess: 1, p_answer: "zebra",
    })).error?.code).toBe("42501");
    expect((await db.rpc("submit_scored_guess", {
      p_id: id, p_player_id: playerId, p_round: 1, p_guess: 1, p_answer: "donkey", p_exact_answer: "donkey",
      p_semantic_matched: false, p_board_attempts: 0,
    })).error?.code).toBe("42501");
    expect((await db.rpc("scored_run_summary", {
      p_player_id: playerId, p_today: toIsoDate(new Date()),
    })).error?.code).toBe("42501");
    expect((await db.rpc("scored_daily_results", {
      p_id: id, p_player_id: playerId,
    })).error?.code).toBe("42501");
  });
});

describe.skipIf(!container)("historical player-first backfill", () => {
  it("seeds every published date idempotently and lets old players start fresh without rewriting their scores", () => {
    const pairs = JSON.stringify(dailyPairsForPuzzle(1));
    execFileSync("docker", ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: `begin;
        do $$
        declare
          v_player text := gen_random_uuid()::text;
          v_old uuid;
          v_new uuid;
          v_date date;
          v_words jsonb;
          v_count integer;
        begin
          v_old := (public.start_daily_run(v_player, '2026-09-30', 1, '${pairs}'::jsonb)->>'id')::uuid;
          update public.daily_runs set status = 'completed', score = 4000, completed_at = '2026-09-30T12:00:00Z' where id = v_old;
          for v_date in select generate_series('2026-09-30'::date, current_date, '1 day')::date loop
            perform public.seed_scored_puzzle(v_date, v_date - '2026-09-30'::date + 1,
              '["zebra","mountain","coffee","ocean","moon"]'::jsonb);
            select opening_words into v_words from public.scored_puzzles where puzzle_date = v_date;
            perform public.seed_scored_puzzle(v_date, v_date - '2026-09-30'::date + 1,
              '["elephant","mountain","coffee","ocean","moon"]'::jsonb);
            if (select opening_words from public.scored_puzzles where puzzle_date = v_date) <> v_words then
              raise exception 'Backfill replaced published words';
            end if;
          end loop;
          select count(*) into v_count from public.scored_puzzles
            where puzzle_date between '2026-09-30'::date and current_date and jsonb_array_length(opening_words) = 5;
          if v_count <> current_date - '2026-09-30'::date + 1 then raise exception 'Historical dates are missing'; end if;
          v_new := (public.start_scored_run(v_player, '2026-09-30', 1,
            '["zebra","mountain","coffee","ocean","moon"]'::jsonb)->>'id')::uuid;
          if v_new = v_old then raise exception 'Reused an old-format attempt'; end if;
          if (select score from public.daily_runs where id = v_old) <> 4000 then raise exception 'Rewrote an old score'; end if;
          if (select count(*) from public.scored_rounds where run_id = v_new
            and word_a = '' and word_b = '' and ai_answer is not null) <> 5 then
            raise exception 'Historical run did not get five committed hidden openings';
          end if;
        end;
        $$;
        rollback;`,
      stdio: ["pipe", "pipe", "pipe"],
    });
  });
});
