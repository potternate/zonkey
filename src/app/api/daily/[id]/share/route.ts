import { NextResponse } from "next/server";
import { shareDaily } from "@/server/daily-service";
import { getPlayerId, parseGameId, withErrors } from "@/server/http";

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await shareDaily(await getPlayerId(req), parseGameId((await ctx.params).id));
  return NextResponse.json({ ok: true });
});
