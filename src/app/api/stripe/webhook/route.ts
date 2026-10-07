import { NextResponse } from "next/server";
import { GameError } from "@/server/errors";
import { withErrors } from "@/server/http";
import { fulfillCheckout, stripeClient } from "@/server/stripe";

export const POST = withErrors(async (req: Request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new GameError("not_configured", "Payment verification is not configured.");
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new GameError("bad_request", "Missing webhook signature.");
  const raw = await req.text();
  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    throw new GameError("bad_request", "Invalid webhook signature.");
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await fulfillCheckout(event.data.object.id);
  }
  return NextResponse.json({ received: true });
});
