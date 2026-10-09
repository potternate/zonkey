import { NextResponse } from "next/server";
import { plusEnabled, requireSameOrigin, requireUser } from "@/server/auth";
import { hasPlusAccess } from "@/server/account-store";
import { GameError } from "@/server/errors";
import { siteUrl, stripeClient } from "@/server/stripe";
import { withErrors } from "@/server/http";

export const POST = withErrors(async (req: Request) => {
  requireSameOrigin(req);
  if (!plusEnabled()) throw new GameError("not_found", "Not found.");
  const user = await requireUser();
  if (await hasPlusAccess(user.id)) throw new GameError("conflict", "Zonkey Plus is already unlocked.");
  const origin = siteUrl();
  const metadata = { product: "zonkey_plus", user_id: user.id };
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: user.id,
    customer_email: user.email,
    metadata,
    payment_intent_data: { metadata },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: 500,
        product_data: { name: "Zonkey Plus", description: "Lifetime access to Unlimited and Archive." },
      },
    }],
    success_url: `${origin}/plus?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/plus?cancelled=1`,
  }, { idempotencyKey: `zonkey-plus:${user.id}:${Math.floor(Date.now() / 3_600_000)}` });
  if (!session.url) throw new GameError("internal", "Couldn't open checkout. Try again.");
  return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
});
