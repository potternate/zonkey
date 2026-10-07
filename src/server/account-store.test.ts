import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasPlusAccess, linkPlayerAccount, savePurchase } from "./account-store";
import { SupabaseStore } from "./store/supabase-store";

vi.mock("server-only", () => ({}));
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const container = process.env.SUPABASE_TEST_DB_CONTAINER;
const users = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

describe.skipIf(!url || !key || !container)("account database contracts", () => {
  beforeAll(() => {
    vi.stubEnv("SUPABASE_URL", url!);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key!);
    execFileSync("docker", ["exec", container!, "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-c",
      `insert into auth.users (id, email_confirmed_at) values ${users.map((id) => `('${id}', now())`).join(",")};`]);
  });
  afterAll(() => {
    execFileSync("docker", ["exec", container!, "psql", "-U", "postgres", "-d", "postgres",
      "-c", `delete from auth.users where id in (${users.map((id) => `'${id}'`).join(",")});`]);
    vi.unstubAllEnvs();
  });

  it("links the first player's saved history and returns that same ID on another device", async () => {
    const playerId = crypto.randomUUID();
    const store = new SupabaseStore(url!, key!);
    const game = await store.createGame({
      playerId, mode: "unlimited", puzzleDate: null, puzzleNumber: null, wordA: "zebra", wordB: "donkey",
    });
    expect(await linkPlayerAccount(users[0], playerId)).toBe(playerId);
    const restoredId = await linkPlayerAccount(users[0], crypto.randomUUID());
    expect(restoredId).toBe(playerId);
    expect((await store.getGame(game.id))?.playerId).toBe(restoredId);
    expect(await hasPlusAccess(users[0])).toBe(false);
  });

  it("never gives two accounts the same browser identity under concurrent sign-in", async () => {
    const playerId = crypto.randomUUID();
    const ids = await Promise.all(users.slice(1).map((user) => linkPlayerAccount(user, playerId)));
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(playerId);
    for (let index = 0; index < ids.length; index++) {
      expect(await linkPlayerAccount(users[index + 1], crypto.randomUUID())).toBe(ids[index]);
    }
  });

  it("processes duplicate and simultaneous payment grants exactly once", async () => {
    const purchase = {
      user_id: users[0], checkout_session_id: `cs_test_${crypto.randomUUID()}`,
      payment_intent_id: `pi_${crypto.randomUUID()}`, amount: 500, currency: "usd",
      livemode: false,
    };
    await Promise.all([savePurchase(purchase), savePurchase(purchase), savePurchase(purchase)]);
    await savePurchase(purchase);
    expect(await hasPlusAccess(users[0])).toBe(true);
    expect(await hasPlusAccess(users[1])).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture");
    expect(await hasPlusAccess(users[0])).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    const db = createClient(url!, key!, { auth: { persistSession: false } });
    const rows = await db.from("plus_purchases").select("*").eq("checkout_session_id", purchase.checkout_session_id);
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(1);
    await expect(savePurchase({ ...purchase, checkout_session_id: `cs_test_${crypto.randomUUID()}` })).rejects.toThrow();
    await expect(savePurchase({ ...purchase, checkout_session_id: `cs_test_${crypto.randomUUID()}`, payment_intent_id: `pi_${crypto.randomUUID()}`, amount: 1 })).rejects.toThrow();
  });

  it.each(["SUPABASE_TEST_ANON_KEY", "SUPABASE_TEST_AUTHENTICATED_KEY"])("denies private account access with %s", async (variable) => {
    const db = createClient(url!, process.env[variable]!, { auth: { persistSession: false } });
    for (const table of ["player_accounts", "plus_purchases"]) {
      const response = await db.from(table).select("*");
      expect(response.error?.code).toBe("42501");
      const insert = await db.from(table).insert(table === "player_accounts"
        ? { user_id: users[0], player_id: crypto.randomUUID() }
        : { user_id: users[0], checkout_session_id: "cs_forged", payment_intent_id: "pi_forged", amount: 500, currency: "usd" });
      expect(insert.error?.code).toBe("42501");
    }
    const response = await db.rpc("link_player_account", { p_user_id: users[0], p_player_id: crypto.randomUUID() });
    expect(response.error?.code).toBe("42501");
  });
});
