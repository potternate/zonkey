const STORAGE_KEY = "zonkey:player-id";
const LEGACY_STORAGE_KEY = "connect-two:player-id";
let sessionPlayerId: string | null = null;

export function setPlayerId(id: string): void {
  sessionPlayerId = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export function resetPlayerId(): void {
  setPlayerId(crypto.randomUUID());
}

/** Anonymous, persistent player identity. No account required. */
export function getPlayerId(): string {
  if (sessionPlayerId) return sessionPlayerId;
  let id: string | null = null;
  try {
    id = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); fall through to a fresh id.
  }
  if (!id) {
    id = crypto.randomUUID();
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  sessionPlayerId = id;
  return id;
}
