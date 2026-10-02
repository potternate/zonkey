import { NextResponse } from "next/server";
import { z } from "zod";
import { trackShare } from "@/server/game-service";
import { getPlayerId, parseBody, withErrors } from "@/server/http";

/** Only events that originate in the browser; gameplay events are tracked server-side. */
const bodySchema = z.object({
  name: z.enum(["share_clicked"]),
  gameId: z.uuid(),
});

export const POST = withErrors(async (req: Request) => {
  const playerId = getPlayerId(req);
  const body = await parseBody(req, bodySchema);
  await trackShare(playerId, body.gameId);
  return NextResponse.json({ ok: true });
});
