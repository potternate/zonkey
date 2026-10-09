import { NextResponse } from "next/server";
import { z } from "zod";
import { startGame } from "@/server/game-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";
import { GameError } from "@/server/errors";
import { toIsoDate } from "@/lib/game/daily";
import { assertPlusAccess } from "@/server/plus-access";
import { UNLIMITED_THEMES } from "@/lib/game/themes";

const bodySchema = z.object({
  mode: z.enum(["daily", "unlimited", "practice"]).default("daily"),
  puzzleDate: z.string().optional(),
  theme: z.enum(UNLIMITED_THEMES).optional(),
});

export const POST = withErrors(async (req: Request) => {
  const playerId = await getPlayerId(req);
  const body = await parseBody(req, bodySchema);
  if (body.mode === "daily" && (!body.puzzleDate || body.puzzleDate === toIsoDate(new Date()))) {
    throw new GameError("conflict", "Daily now has five rounds. Refresh Zonkey to play.");
  }
  await assertPlusAccess();
  const game = await startGame({
    playerId, mode: body.mode, puzzleDate: body.puzzleDate, theme: body.theme,
    playerFirst: body.mode === "unlimited",
  }, false);
  return NextResponse.json({ game });
});
