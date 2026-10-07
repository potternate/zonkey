import { NextResponse } from "next/server";
import { dailyResults } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const results = await dailyResults(await getPlayerId(req), parseGameId((await ctx.params).id));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
});
