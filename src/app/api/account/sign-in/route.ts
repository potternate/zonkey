import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, requireSameOrigin } from "@/server/auth";
import { parseBody, withErrors } from "@/server/http";
import { GameError } from "@/server/errors";

export const POST = withErrors(async (req: Request) => {
  requireSameOrigin(req);
  const { email } = await parseBody(req, z.object({ email: z.email().max(254) }));
  const { error } = await (await authClient()).auth.signInWithOtp({ email });
  if (error) {
    throw new GameError(error.status === 429 ? "rate_limited" : "not_configured",
      error.status === 429 ? "Please wait before requesting another code." : "Couldn't send your sign-in code. Try again.");
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
