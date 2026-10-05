import { NextResponse } from "next/server";
import { toIsoDate } from "@/lib/game/daily";
import { getPlayerId, withErrors } from "@/server/http";
import { getStore } from "@/server/store";
import { getDailyStore } from "@/server/store/daily-index";

export const GET = withErrors(async (req: Request) => {
  const playerId = getPlayerId(req);
  const today = toIsoDate(new Date());
  const [scores, dailyRuns] = await Promise.all([
    getStore().getPlayerScores(playerId, today),
    getDailyStore().summary(playerId, today),
  ]);
  scores.dailyRuns = dailyRuns;
  scores.dailyStreak = dailyRuns.streak;
  return NextResponse.json({ scores }, { headers: { "Cache-Control": "no-store" } });
});
