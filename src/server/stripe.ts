import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { savePurchase } from "./account-store";
import { GameError } from "./errors";

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new GameError("not_configured", "Checkout is not available yet.");
  return new Stripe(key, { maxNetworkRetries: 2 });
}

export function siteUrl(): string {
  const value = process.env.ZONKEY_SITE_URL;
  if (!value) throw new GameError("not_configured", "Checkout is not available yet.");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new GameError("not_configured", "Checkout is not available yet.");
  }
  return url.origin;
}

export async function fulfillCheckout(sessionId: string, expectedUserId?: string): Promise<boolean> {
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  if (expectedUserId && session.metadata?.user_id !== expectedUserId) {
    throw new GameError("not_found", "Checkout not found.");
  }
  if (session.metadata?.product !== "zonkey_plus") return false;
  const userId = z.uuid().safeParse(session.metadata.user_id);
  if (!userId.success || session.client_reference_id !== userId.data ||
    session.mode !== "payment" || session.status !== "complete" ||
    session.payment_status !== "paid" || session.amount_total !== 500 || session.currency !== "usd") {
    return false;
  }
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentId) return false;
  await savePurchase({
    user_id: userId.data,
    checkout_session_id: session.id,
    payment_intent_id: paymentId,
    amount: session.amount_total,
    currency: session.currency,
  });
  return true;
}
