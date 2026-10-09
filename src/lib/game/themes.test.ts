import { describe, expect, it } from "vitest";
import { randomThemedPair, THEMED_PAIRS, UNLIMITED_THEMES } from "./themes";
import { STARTING_PAIRS, randomStartingPair } from "./pairs";

describe("Unlimited themes", () => {
  it.each(UNLIMITED_THEMES)("%s has distinct, valid pairs and selects the full curated set", (theme) => {
    const pool = THEMED_PAIRS[theme];
    expect(pool.length).toBeGreaterThanOrEqual(20);
    expect(new Set(pool.map(({ a, b }) => [a, b].sort().join("|"))).size).toBe(pool.length);
    for (let index = 0; index < pool.length; index++) {
      expect(randomThemedPair(theme, () => (index + 0.5) / pool.length)).toBe(pool[index]);
      expect(pool[index].a).toMatch(/^[a-z]+$/);
      expect(pool[index].b).toMatch(/^[a-z]+$/);
      expect(pool[index].a).not.toBe(pool[index].b);
    }
  });

  it("retains the thousands of random Unlimited pairs", () => {
    expect(STARTING_PAIRS.length).toBeGreaterThan(5000);
    expect(STARTING_PAIRS).toContainEqual(randomStartingPair(() => 0.8));
  });
});
