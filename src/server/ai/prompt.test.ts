import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_PROMPT, getSystemPrompt } from "./prompt";

beforeEach(() => {
  vi.stubEnv("ZONKEY_SYSTEM_PROMPT", "");
  vi.stubEnv("CONNECT_TWO_SYSTEM_PROMPT", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Zonkey prompt configuration", () => {
  it("uses the Zonkey default without an override", () => {
    expect(getSystemPrompt()).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it("prefers the Zonkey override and trims it", () => {
    vi.stubEnv("ZONKEY_SYSTEM_PROMPT", "  custom Zonkey prompt  ");
    vi.stubEnv("CONNECT_TWO_SYSTEM_PROMPT", "old override");
    expect(getSystemPrompt()).toBe("custom Zonkey prompt");
  });

  it("preserves existing overrides when the Zonkey value is empty", () => {
    vi.stubEnv("ZONKEY_SYSTEM_PROMPT", "  ");
    vi.stubEnv("CONNECT_TWO_SYSTEM_PROMPT", "  existing prompt  ");
    expect(getSystemPrompt()).toBe("existing prompt");
  });
});
