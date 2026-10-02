import { NextResponse } from "next/server";
import { getGame } from "@/server/game-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = getPlayerId(req);
  const gameId = parseGameId((await ctx.params).id);
  return NextResponse.json({ game: await getGame(playerId, gameId) });
});
