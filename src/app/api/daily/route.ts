import { NextResponse } from "next/server";
import { z } from "zod";
import { startDaily } from "@/server/daily-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";

export const POST = withErrors(async (req: Request) => {
  const { date } = await parseBody(req, z.object({ date: z.string().optional() }));
  const run = await startDaily(getPlayerId(req), date);
  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
});
