import { describe, expect, it } from "vitest";
import { heatBand, zonkeyLine } from "./reactions";

describe("Zonkey reactions", () => {
  it("bands closeness from freezing to on fire", () => {
    expect([0, 14, 15, 35, 55, 74, 75, 100].map(heatBand)).toEqual(["freezing", "freezing", "cold", "warm", "hot", "hot", "fire", "fire"]);
  });

  it("picks a stable line for the same guess", () => {
    const input = { matched: false, synonym: false, opening: false, roundOver: false, closeness: 80 };
    expect(zonkeyLine(input, "boat:water")).toBe(zonkeyLine(input, "boat:water"));
    expect(["SO close. I can feel it.", "Ahh, one step away!"]).toContain(zonkeyLine(input, "boat:water"));
  });

  it("prioritizes matches and finished rounds over heat", () => {
    const base = { synonym: false, opening: false, closeness: 5 };
    expect(zonkeyLine({ ...base, matched: true, roundOver: true }, "a")).not.toMatch(/planets|same game/);
    expect(zonkeyLine({ ...base, matched: false, roundOver: true }, "a")).toMatch(/guesses|got away/);
  });
});
