import "server-only";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { GameStore } from "./types";

const globalForStore = globalThis as typeof globalThis & { __zonkeyStore?: GameStore };

export function getStore(): GameStore {
  if (globalForStore.__zonkeyStore) return globalForStore.__zonkeyStore;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let store: GameStore;
  if (url && key) {
    store = new SupabaseStore(url, key);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[zonkey] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set; using in-memory store.");
    store = new MemoryStore();
  } else {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production");
  }
  globalForStore.__zonkeyStore = store;
  return store;
}
