import { NextResponse } from "next/server";
import { z } from "zod";
import { startDaily, startUnlimited } from "@/server/daily-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";
import { assertDailyStartAccess, assertPlusAccess } from "@/server/plus-access";
import { UNLIMITED_THEMES } from "@/lib/game/themes";
import { GameError } from "@/server/errors";

export const POST = withErrors(async (req: Request) => {
  const { date, puzzleDate, mode, theme, requestId } = await parseBody(req, z.object({
    date: z.string().optional(), puzzleDate: z.string().optional(),
    mode: z.enum(["daily", "unlimited"]).default("daily"),
    theme: z.enum(UNLIMITED_THEMES).optional(),
    requestId: z.uuid().optional(),
  }));
  const chosenDate = date ?? puzzleDate;
  if (mode !== "unlimited" && theme) throw new GameError("bad_request", "Themes are only available in Unlimited.");
  if (mode === "unlimited" && chosenDate !== undefined) throw new GameError("bad_request", "Unlimited has no puzzle date.");
  const playerId = await getPlayerId(req);
  if (mode === "unlimited") await assertPlusAccess();
  else await assertDailyStartAccess(playerId, chosenDate);
  const run = mode === "unlimited" ? await startUnlimited(playerId, theme, requestId) : await startDaily(playerId, chosenDate);
  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
});
