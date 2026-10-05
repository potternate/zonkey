import { describe, expect, it } from "vitest";
import { buildShareText, gameShareUrl } from "./share";
import { dateForPuzzleNumber, puzzleNumberForDate } from "./daily";
import type { GameView } from "./types";

describe("archive sharing", () => {
  const archive: GameView = {
    id: "archive", mode: "practice", puzzleNumber: 2, status: "won", maxRounds: 8,
    startPair: { a: "pizza", b: "ocean", emojiA: "🍕", emojiB: "🌊" }, current: null,
    rounds: [{ number: 1, wordA: "pizza", wordB: "ocean", playerAnswer: "beach", aiAnswer: "beach", matched: true }],
  };

  it("labels practice results and links back to the correct puzzle without spoilers", () => {
    const url = gameShareUrl(archive, "https://zonkey.io");
    expect(url).toBe("https://zonkey.io/?daily=2026-10-01");
    const text = buildShareText(archive, url);
    expect(text).toBe("Zonkey · Archive #2\nConnected in 1/8 🦓\n\n🟩🟩\nhttps://zonkey.io/?daily=2026-10-01");
    expect(text).not.toMatch(/pizza|ocean|beach/);
    expect(gameShareUrl({ ...archive, mode: "daily" }, "https://zonkey.io")).toBe(url);
  });

  it("preserves puzzle numbering over leap days and year boundaries", () => {
    for (const date of ["2026-09-30", "2027-01-01", "2028-02-29"]) {
      expect(dateForPuzzleNumber(puzzleNumberForDate(date))).toBe(date);
    }
  });
});
