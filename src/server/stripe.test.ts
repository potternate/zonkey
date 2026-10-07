import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fulfillCheckout } from "./stripe";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as confirm } from "@/app/api/checkout/confirm/route";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  retrieve: vi.fn(), create: vi.fn(), save: vi.fn(), plus: false, signedIn: true,
  userId: "e1d18f06-5278-4754-9b23-b71ecbfb6c72",
}));
vi.mock("./account-store", () => ({ savePurchase: state.save, hasPlusAccess: async () => state.plus, livePayments: () => false }));
vi.mock("./auth", async () => {
  const actual = await vi.importActual<typeof import("./auth")>("./auth");
  const { GameError } = await vi.importActual<typeof import("./errors")>("./errors");
  return {
    ...actual,
    requireUser: async () => {
      if (!state.signedIn) throw new GameError("auth_required", "Sign in.");
      return { id: state.userId, email: "player@example.com" };
    },
  };
});
vi.mock("stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("stripe")>();
  return { default: class extends original.default {
    constructor(...args: ConstructorParameters<typeof original.default>) {
      super(...args);
      this.checkout.sessions.retrieve = state.retrieve;
      this.checkout.sessions.create = state.create;
    }
  } };
});

function paidSession(overrides: object = {}) {
  return {
    id: "cs_test_purchase",
    metadata: { user_id: state.userId, product: "zonkey_plus" },
    client_reference_id: state.userId,
    mode: "payment", status: "complete", payment_status: "paid",
    amount_total: 500, currency: "usd", payment_intent: "pi_purchase",
    livemode: false,
    ...overrides,
  };
}
function request(body?: object, origin = "http://localhost") {
  return new Request("http://localhost/api/checkout", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("ZONKEY_PLUS_ENABLED", "true");
  vi.stubEnv("ZONKEY_SITE_URL", "http://localhost");
  state.retrieve.mockReset().mockResolvedValue(paidSession());
  state.create.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/example" });
  state.save.mockReset().mockResolvedValue(undefined);
  state.plus = false;
  state.signedIn = true;
});

describe("one-time payment fulfillment", () => {
  it("records a verified $5 purchase and tolerates duplicate delivery", async () => {
    await fulfillCheckout("cs_test_purchase");
    await fulfillCheckout("cs_test_purchase");
    expect(state.save).toHaveBeenCalledWith({
      user_id: state.userId, checkout_session_id: "cs_test_purchase",
      payment_intent_id: "pi_purchase", amount: 500, currency: "usd", livemode: false,
    });
  });

  it.each([
    { payment_status: "unpaid" }, { payment_status: "no_payment_required" }, { amount_total: 499 },
    { amount_total: 1000 }, { currency: "eur" }, { mode: "subscription" },
    { status: "open" }, { payment_intent: null }, { livemode: true }, { client_reference_id: crypto.randomUUID() },
    { metadata: { user_id: "invalid", product: "zonkey_plus" } },
    { metadata: { user_id: state.userId, product: "other" } },
  ])("does not grant access for an ineligible session: %j", async (overrides) => {
    state.retrieve.mockResolvedValue(paidSession(overrides));
    expect(await fulfillCheckout("cs_test_purchase")).toBe(false);
    expect(state.save).not.toHaveBeenCalled();
  });

  it("prevents confirming someone else's checkout", async () => {
    await expect(fulfillCheckout("cs_test_purchase", crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
    expect(state.save).not.toHaveBeenCalled();
  });

  it("uses trusted account metadata and a fixed payment-mode price", async () => {
    const response = await checkout(request({ amount: 1, user_id: crypto.randomUUID(), mode: "subscription" }));
    expect(response.status).toBe(200);
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment", customer_email: "player@example.com", client_reference_id: state.userId,
      metadata: { user_id: state.userId, product: "zonkey_plus" },
      line_items: [expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 500, currency: "usd" }) })],
    }), expect.objectContaining({ idempotencyKey: expect.stringContaining(state.userId) }));
    expect((await confirm(request({ sessionId: "cs_test_purchase" }))).status).toBe(200);
  });

  it("rejects anonymous, already-paid and cross-origin checkout requests", async () => {
    state.signedIn = false;
    expect((await checkout(request())).status).toBe(401);
    state.signedIn = true;
    state.plus = true;
    expect((await checkout(request())).status).toBe(409);
    expect((await checkout(request(undefined, "https://attacker.example"))).status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("verifies the raw webhook signature and returns errors for retryable persistence failures", async () => {
    const payload = JSON.stringify({ id: "evt_fixture", type: "checkout.session.completed", data: { object: { id: "cs_test_purchase" } } });
    const signature = new Stripe("sk_test_fixture").webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture" });
    const incoming = () => new Request("http://localhost/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": signature }, body: payload,
    });
    expect((await webhook(incoming())).status).toBe(200);
    expect(state.retrieve).toHaveBeenCalledWith("cs_test_purchase");
    expect((await webhook(new Request("http://localhost", { method: "POST", body: payload }))).status).toBe(400);
    expect((await webhook(new Request("http://localhost", { method: "POST", headers: { "stripe-signature": "invalid" }, body: payload }))).status).toBe(400);
    state.save.mockRejectedValueOnce(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await webhook(incoming())).status).toBe(500);
    log.mockRestore();
  });
});
