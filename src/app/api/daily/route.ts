import { NextResponse } from "next/server";
import { z } from "zod";
import { startDaily } from "@/server/daily-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";
import { assertDailyStartAccess } from "@/server/plus-access";

export const POST = withErrors(async (req: Request) => {
  const { date } = await parseBody(req, z.object({ date: z.string().optional() }));
  const playerId = await getPlayerId(req);
  await assertDailyStartAccess(playerId, date);
  const run = await startDaily(playerId, date);
  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
});
