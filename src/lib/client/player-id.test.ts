import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalId = "28c0ac2d-e846-4ab7-8678-4231b73be9e5";
const zonkeyId = "c4c7611b-747f-4f0e-ae04-1f943e30cdd6";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function storageWith(entries: [string, string][] = []) {
  const data = new Map(entries);
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
  };
  vi.stubGlobal("localStorage", storage);
  return { data, storage };
}

describe("Zonkey anonymous player identity", () => {
  it("keeps a returning player's identity and legacy key during the rebrand", async () => {
    const { data } = storageWith([["connect-two:player-id", originalId]]);
    const { getPlayerId } = await import("./player-id");
    expect(getPlayerId()).toBe(originalId);
    expect(data.get("zonkey:player-id")).toBe(originalId);
    expect(data.get("connect-two:player-id")).toBe(originalId);
  });

  it("prefers the Zonkey identity when both keys exist", async () => {
    storageWith([["zonkey:player-id", zonkeyId], ["connect-two:player-id", originalId]]);
    const { getPlayerId } = await import("./player-id");
    expect(getPlayerId()).toBe(zonkeyId);
  });

  it("creates and persists just one identity for a new player", async () => {
    const { data, storage } = storageWith();
    const { getPlayerId } = await import("./player-id");
    const id = getPlayerId();
    expect(id).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
    expect(data.get("zonkey:player-id")).toBe(id);
    expect(getPlayerId()).toBe(id);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("retains the existing identity even if migration cannot be written", async () => {
    const { storage } = storageWith([["connect-two:player-id", originalId]]);
    storage.setItem.mockImplementation(() => { throw new DOMException("Storage full", "QuotaExceededError"); });
    const { getPlayerId } = await import("./player-id");
    expect(getPlayerId()).toBe(originalId);
    expect(getPlayerId()).toBe(originalId);
  });

  it("keeps a session identity when storage access is blocked", async () => {
    const { storage } = storageWith();
    storage.getItem.mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    storage.setItem.mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    const { getPlayerId } = await import("./player-id");
    const id = getPlayerId();
    expect(id).toBeTruthy();
    expect(getPlayerId()).toBe(id);
  });
});
