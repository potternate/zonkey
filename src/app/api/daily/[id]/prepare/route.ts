import { NextResponse } from "next/server";
import { prepareDaily } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";
import { assertDailyAccess } from "@/server/plus-access";

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = await getPlayerId(req);
  const id = parseGameId((await ctx.params).id);
  await assertDailyAccess(playerId, id, true);
  return NextResponse.json({ run: await prepareDaily(playerId, id) }, { headers: { "Cache-Control": "no-store" } });
});
