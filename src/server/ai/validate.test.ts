import { describe, expect, it } from "vitest";
import { mockChoice } from "./mock-player";
import { checkAiWord } from "./validate";

describe("checkAiWord", () => {
  it("normalizes valid words", () => {
    expect(checkAiWord(" Water. ", "beach", "boat")).toEqual({ ok: true, word: "water" });
  });

  it("rejects endpoints, phrases and non-strings", () => {
    expect(checkAiWord("Beach", "beach", "boat").ok).toBe(false);
    expect(checkAiWord("sea shore", "beach", "boat").ok).toBe(false);
    expect(checkAiWord(42, "beach", "boat").ok).toBe(false);
  });
});

describe("mockChoice", () => {
  it("is deterministic and never an endpoint", () => {
    expect(mockChoice("water", "fire")).toBe(mockChoice("water", "fire"));
    expect(["water", "fire"]).not.toContain(mockChoice("water", "fire"));
  });
});
