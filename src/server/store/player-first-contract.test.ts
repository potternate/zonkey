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
    const pairs = dailyPairsForPuzzle(11);
    const starts = await Promise.all(["zebra", "elephant"].map((word) =>
      store.start(crypto.randomUUID(), "2026-10-10", 11, pairs, [word, "mountain", "coffee", "ocean", "moon"]),
    ));
    expect(starts[0].run.openingWords).toEqual(starts[1].run.openingWords);
    expect(JSON.stringify(toDailyView(starts[1].run))).not.toContain("zebra");
    const first = await store.start(crypto.randomUUID(), "2026-10-11", 12, pairs);
    const legacy = await store.start(crypto.randomUUID(), "2026-10-11", 12, pairs, presetOpeningWords(5));
    expect(legacy.run.openingWords).toBeUndefined();
    expect(toDailyView(legacy.run).rounds[0].startPair).toEqual(toDailyView(first.run).rounds[0].startPair);
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
  });
});
