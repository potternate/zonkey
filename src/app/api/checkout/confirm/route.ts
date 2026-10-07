import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin, requireUser } from "@/server/auth";
import { parseBody, withErrors } from "@/server/http";
import { fulfillCheckout } from "@/server/stripe";

export const POST = withErrors(async (req: Request) => {
  requireSameOrigin(req);
  const user = await requireUser();
  const { sessionId } = await parseBody(req, z.object({
    sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]+$/).max(250),
  }));
  const plus = await fulfillCheckout(sessionId, user.id);
  return NextResponse.json({ plus }, { headers: { "Cache-Control": "no-store" } });
});
