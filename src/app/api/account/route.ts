import { NextResponse } from "next/server";
import { currentUser, plusEnabled } from "@/server/auth";
import { hasPlusAccess } from "@/server/account-store";
import { getPlayerId, withErrors } from "@/server/http";
import { GameError } from "@/server/errors";

export const GET = withErrors(async (req: Request) => {
  const user = await currentUser();
  let playerId: string | null = null;
  let restore = false;
  try {
    playerId = await getPlayerId(req);
  } catch (error) {
    if (error instanceof GameError && error.code === "auth_required") restore = true;
    else throw error;
  }
  return NextResponse.json({
    enabled: plusEnabled(),
    email: user?.email ?? null,
    plus: user ? await hasPlusAccess(user.id) : false,
    playerId,
    restore,
  }, { headers: { "Cache-Control": "no-store" } });
});
