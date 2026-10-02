import { describe, expect, it } from "vitest";
import { buildShareText } from "./share";
import type { GameView } from "./types";

const base: GameView = {
  id: "g",
  mode: "daily",
  puzzleNumber: 142,
  status: "won",
  maxRounds: 8,
  startPair: { a: "pizza", b: "ocean", emojiA: "🍕", emojiB: "🌊" },
  rounds: [
    { number: 1, wordA: "pizza", wordB: "ocean", playerAnswer: "beach", aiAnswer: "boat", matched: false },
    { number: 2, wordA: "beach", wordB: "boat", playerAnswer: "water", aiAnswer: "water", matched: true },
  ],
  current: null,
};

describe("buildShareText", () => {
  it("masks guessed words", () => {
    const text = buildShareText(base, "https://example.com");
    expect(text).toBe(["Zonkey #142", "2/8", "", "⬜⬜ 🟩🟩", "https://example.com"].join("\n"));
    expect(text).not.toMatch(/pizza|ocean|beach|boat|water|🍕|🌊/);
  });

  it("marks losses and practice games", () => {
    const rounds = Array.from({ length: 8 }, (_, index) => ({ ...base.rounds[0], number: index + 1 }));
    const text = buildShareText({ ...base, mode: "practice", puzzleNumber: null, status: "lost", rounds });
    expect(text).toBe(["Zonkey · Practice", "X/8", "", Array(8).fill("⬜⬜").join(" ")].join("\n"));
  });

  it("labels Unlimited results without a daily puzzle number", () => {
    expect(buildShareText({ ...base, mode: "unlimited", puzzleNumber: null }).split("\n")[0]).toBe("Zonkey · Unlimited");
  });

  it("shows green for a semantic win without revealing either synonym", () => {
    const rounds = [{ ...base.rounds[0], playerAnswer: "boat", aiAnswer: "ship", matched: true }];
    const text = buildShareText({ ...base, rounds });
    expect(text).toBe("Zonkey #142\n1/8\n\n🟩🟩");
    expect(text).not.toMatch(/boat|ship/);
  });
});
