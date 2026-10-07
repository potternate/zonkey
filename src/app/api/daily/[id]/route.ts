import { NextResponse } from "next/server";
import { getDaily } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";
import { assertDailyAccess } from "@/server/plus-access";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = await getPlayerId(req);
  const id = parseGameId((await ctx.params).id);
  await assertDailyAccess(playerId, id);
  const run = await getDaily(playerId, id);
  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
});
