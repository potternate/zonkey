import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_ROUNDS } from "@/lib/game/config";
import { submitAnswer } from "@/server/game-service";
import { getPlayerId, parseBody, parseGameId, withErrors } from "@/server/http";

const bodySchema = z.object({
  roundNumber: z.number().int().min(1).max(MAX_ROUNDS),
  answer: z.string().max(200),
});

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const playerId = getPlayerId(req);
  const gameId = parseGameId((await ctx.params).id);
  const body = await parseBody(req, bodySchema);
  const result = await submitAnswer({ playerId, gameId, roundNumber: body.roundNumber, answer: body.answer });
  return NextResponse.json(result);
});
