import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GameError } from "./errors";
import { currentUser } from "./auth";
import { isAccountPlayer, linkPlayerAccount } from "./account-store";

const playerIdSchema = z.uuid();

export const PLAYER_ID_HEADER = "x-player-id";

export async function getPlayerId(req: Request): Promise<string> {
  const parsed = playerIdSchema.safeParse(req.headers.get(PLAYER_ID_HEADER));
  if (!parsed.success) throw new GameError("bad_request", "Missing or invalid player id.");
  const user = await currentUser();
  if (user) return linkPlayerAccount(user.id, parsed.data);
  if (process.env.SUPABASE_PUBLISHABLE_KEY && await isAccountPlayer(parsed.data)) {
    throw new GameError("auth_required", "Sign in to restore your saved games.");
  }
  return parsed.data;
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new GameError("bad_request", "Invalid request.");
  return parsed.data;
}

export function parseGameId(id: string): string {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new GameError("not_found", "Game not found.");
  return parsed.data;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[zonkey] unhandled", err);
  return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 });
}

export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
