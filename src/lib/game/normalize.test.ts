import { describe, expect, it } from "vitest";
import { normalizeAnswer, validateAnswer } from "./normalize";

describe("normalizeAnswer", () => {
  it.each([
    ["  Beach  ", "beach"],
    ["WATER!", "water"],
    ["Café", "cafe"],
    ["don't", "dont"],
    ["ice-cream", "ice-cream"],
    ["--sun--", "sun"],
    ['"moon."', "moon"],
    ["two  words", "two words"],
  ])("%j -> %j", (raw, expected) => {
    expect(normalizeAnswer(raw)).toBe(expected);
  });
});

describe("validateAnswer", () => {
  const endpoints = ["pizza", "ocean"] as const;

  it("accepts a single word", () => {
    expect(validateAnswer(" Beach! ", endpoints)).toEqual({ ok: true, word: "beach" });
  });

  it("rejects empty input", () => {
    expect(validateAnswer(" !! ", endpoints).ok).toBe(false);
  });

  it("rejects multiple words", () => {
    expect(validateAnswer("sea food", endpoints)).toMatchObject({ ok: false, error: "One word only." });
  });

  it("rejects an endpoint", () => {
    expect(validateAnswer("Pizza", endpoints).ok).toBe(false);
  });

  it("rejects very long words", () => {
    expect(validateAnswer("a".repeat(40), endpoints).ok).toBe(false);
  });
});
