import { NextResponse } from "next/server";
import { getDailyResults } from "@/server/game-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = getPlayerId(req);
  const gameId = parseGameId((await ctx.params).id);
  return NextResponse.json(
    { results: await getDailyResults(playerId, gameId) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
