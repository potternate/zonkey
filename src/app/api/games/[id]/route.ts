import { NextResponse } from "next/server";
import { getGame } from "@/server/game-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";
import { assertGameAccess } from "@/server/plus-access";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = await getPlayerId(req);
  const gameId = parseGameId((await ctx.params).id);
  await assertGameAccess(playerId, gameId);
  return NextResponse.json({ game: await getGame(playerId, gameId) });
});
