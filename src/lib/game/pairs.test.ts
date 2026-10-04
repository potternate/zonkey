import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "./normalize";
import {
  findStartingPair,
  LEGACY_STARTING_PAIRS,
  randomStartingPair,
  STARTING_PAIRS,
  STARTING_WORDS,
} from "./pairs";

describe("starting pairs", () => {
  it("offers at least 1,000 unique one-word endpoints", () => {
    expect(STARTING_WORDS.length).toBeGreaterThanOrEqual(1_000);
    expect(new Set(STARTING_WORDS).size).toBe(STARTING_WORDS.length);

    for (const word of STARTING_WORDS) {
      expect(normalizeAnswer(word)).toBe(word);
      expect(word).not.toContain(" ");
    }
  });

  it("offers thousands of unique unordered pairs", () => {
    expect(STARTING_PAIRS.length).toBeGreaterThanOrEqual(5_000);

    const keys = STARTING_PAIRS.map(({ a, b }) =>
      [a, b].sort().join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(STARTING_PAIRS.every(({ a, b }) => a !== b)).toBe(true);
  });

  it("keeps every original pair at the start of the rotation", () => {
    expect(
      STARTING_PAIRS.slice(0, LEGACY_STARTING_PAIRS.length),
    ).toEqual(LEGACY_STARTING_PAIRS);
  });

  it("finds generated pairs and samples the full rotation", () => {
    const generated = STARTING_PAIRS[LEGACY_STARTING_PAIRS.length];
    expect(findStartingPair(generated.a, generated.b)).toBe(generated);
    expect(randomStartingPair(() => 0)).toBe(STARTING_PAIRS[0]);
    expect(randomStartingPair(() => 0.999999)).toBe(
      STARTING_PAIRS.at(-1),
    );
  });
});
