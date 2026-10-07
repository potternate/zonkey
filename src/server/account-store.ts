import "server-only";
import { createClient } from "@supabase/supabase-js";
import { GameError } from "./errors";

export interface PlusPurchase {
  checkout_session_id: string;
  user_id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GameError("not_configured", "Accounts are not available yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function linkPlayerAccount(userId: string, playerId: string): Promise<string> {
  const { data, error } = await database().rpc("link_player_account", {
    p_user_id: userId, p_player_id: playerId,
  });
  if (error || typeof data !== "string") throw new Error("Account linking failed.");
  return data;
}

export async function isAccountPlayer(playerId: string): Promise<boolean> {
  const { count, error } = await database().from("player_accounts")
    .select("*", { count: "exact", head: true }).eq("player_id", playerId);
  if (error) throw new Error("Account lookup failed.");
  return (count ?? 0) > 0;
}

export async function hasPlusAccess(userId: string): Promise<boolean> {
  const { count, error } = await database().from("plus_purchases")
    .select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error("Plus lookup failed.");
  return (count ?? 0) > 0;
}

export async function savePurchase(purchase: PlusPurchase): Promise<void> {
  const { error } = await database().from("plus_purchases").upsert(purchase, {
    onConflict: "checkout_session_id", ignoreDuplicates: true,
  });
  if (error) throw new Error("Plus purchase could not be saved.");
}
