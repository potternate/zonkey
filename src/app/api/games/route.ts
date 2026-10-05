import { NextResponse } from "next/server";
import { z } from "zod";
import { startGame } from "@/server/game-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";

const bodySchema = z.object({
  mode: z.enum(["daily", "unlimited", "practice"]).default("daily"),
  puzzleDate: z.string().optional(),
});

export const POST = withErrors(async (req: Request) => {
  const playerId = getPlayerId(req);
  const body = await parseBody(req, bodySchema);
  const game = await startGame({ playerId, mode: body.mode, puzzleDate: body.puzzleDate });
  return NextResponse.json({ game });
});
