import { describe, expect, it } from "vitest";
import { formatCountdown, msUntilNextDaily } from "./countdown";

describe("next daily countdown", () => {
  it("counts down to midnight UTC", () => {
    expect(msUntilNextDaily(Date.UTC(2026, 10, 13, 23, 59, 30))).toBe(30_000);
    expect(msUntilNextDaily(Date.UTC(2026, 11, 31, 0, 0, 0))).toBe(86_400_000);
  });

  it("formats as HH:MM:SS and never goes negative", () => {
    expect(formatCountdown(86_400_000)).toBe("24:00:00");
    expect(formatCountdown(3_723_400)).toBe("01:02:04");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});
