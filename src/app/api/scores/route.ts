import { NextResponse } from "next/server";
import { toIsoDate } from "@/lib/game/daily";
import { getPlayerId, withErrors } from "@/server/http";
import { getStore } from "@/server/store";

export const GET = withErrors(async (req: Request) => {
  const scores = await getStore().getPlayerScores(getPlayerId(req), toIsoDate(new Date()));
  return NextResponse.json({ scores }, { headers: { "Cache-Control": "no-store" } });
});
