import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GameError } from "./errors";

export function plusEnabled(): boolean {
  return process.env.ZONKEY_PLUS_ENABLED === "true";
}

export async function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new GameError("not_configured", "Sign-in is not available yet.");
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
}

export async function currentUser() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const jar = await cookies();
  if (!jar.getAll().some(({ name }) => name.startsWith("sb-"))) return null;
  const { data, error } = await (await authClient()).auth.getUser();
  if (error) {
    if (error.status && error.status < 500) return null;
    throw new GameError("not_configured", "Sign-in is temporarily unavailable. Try again.");
  }
  return data.user?.email_confirmed_at ? data.user : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new GameError("auth_required", "Sign in to unlock Zonkey Plus.");
  return user;
}

export function requireSameOrigin(req: Request): void {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    throw new GameError("bad_request", "Invalid request origin.");
  }
}
