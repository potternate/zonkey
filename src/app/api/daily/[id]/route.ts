import { NextResponse } from "next/server";
import { getDaily } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";

export const GET = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const run = await getDaily(getPlayerId(req), parseGameId((await ctx.params).id));
  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
});
