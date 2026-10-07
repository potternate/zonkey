import { NextResponse } from "next/server";
import { authClient, requireSameOrigin } from "@/server/auth";
import { withErrors } from "@/server/http";
import { GameError } from "@/server/errors";

export const POST = withErrors(async (req: Request) => {
  requireSameOrigin(req);
  const { error } = await (await authClient()).auth.signOut({ scope: "local" });
  if (error) throw new GameError("not_configured", "Couldn't sign out. Try again.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
