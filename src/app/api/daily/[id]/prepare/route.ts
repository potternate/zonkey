import { NextResponse } from "next/server";
import { prepareDaily, warmDailyOpenings } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";
import { assertDailyAccess } from "@/server/plus-access";

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = await getPlayerId(req);
  const id = parseGameId((await ctx.params).id);
  await assertDailyAccess(playerId, id, true);
  const [prepared] = await Promise.allSettled([prepareDaily(playerId, id), warmDailyOpenings(playerId, id)]);
  if (prepared.status === "rejected") throw prepared.reason;
  return NextResponse.json({ run: prepared.value }, { headers: { "Cache-Control": "no-store" } });
});
