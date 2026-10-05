import { NextResponse } from "next/server";
import { z } from "zod";
import { DAILY_GUESSES, DAILY_ROUNDS } from "@/lib/game/daily-run";
import { submitDaily } from "@/server/daily-service";
import { getPlayerId, parseBody, parseGameId, withErrors } from "@/server/http";

const schema = z.object({
  round: z.number().int().min(1).max(DAILY_ROUNDS),
  guess: z.number().int().min(1).max(DAILY_GUESSES),
  answer: z.string().max(200),
});

export const POST = withErrors(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const body = await parseBody(req, schema);
  const result = await submitDaily({ ...body, id: parseGameId((await ctx.params).id), playerId: getPlayerId(req) });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
});
