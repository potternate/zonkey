import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, requireSameOrigin } from "@/server/auth";
import { getPlayerId, parseBody, withErrors } from "@/server/http";
import { GameError } from "@/server/errors";

export const POST = withErrors(async (req: Request) => {
  requireSameOrigin(req);
  const { email, token } = await parseBody(req, z.object({
    email: z.email().max(254), token: z.string().regex(/^\d{6,10}$/),
  }));
  const client = await authClient();
  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user?.email_confirmed_at) {
    throw new GameError("bad_request", "That code is invalid or expired. Request a new one.");
  }
  const playerId = await getPlayerId(req);
  return NextResponse.json({ playerId }, { headers: { "Cache-Control": "no-store" } });
});
