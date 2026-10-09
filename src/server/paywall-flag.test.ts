import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlusPage from "@/app/plus/page";
import { Landing } from "@/components/game/landing";
import { PlusScreen } from "@/components/game/plus-screen";
import { GET as account } from "@/app/api/account/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as confirm } from "@/app/api/checkout/confirm/route";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  enabled: false, lookup: vi.fn(), create: vi.fn(), fulfill: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./auth", () => ({
  plusEnabled: () => state.enabled,
  currentUser: async () => ({ id: "account", email: "player@example.com" }),
  requireUser: async () => ({ id: "account", email: "player@example.com" }),
  requireSameOrigin: vi.fn(),
}));
vi.mock("./account-store", () => ({
  hasPlusAccess: state.lookup, linkPlayerAccount: async (_user: string, player: string) => player,
}));
vi.mock("./stripe", () => ({
  siteUrl: () => "http://localhost",
  stripeClient: () => ({ checkout: { sessions: { create: state.create } } }),
  fulfillCheckout: state.fulfill,
}));
beforeEach(() => {
  state.enabled = false;
  state.lookup.mockReset().mockResolvedValue(true);
  state.create.mockReset();
  state.fulfill.mockReset();
});
function request() {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { origin: "http://localhost", "x-player-id": crypto.randomUUID(), "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "cs_test_example" }),
  });
}

describe("disabled paywall surfaces", () => {
  it("keeps both modes visible while removing all upgrade copy and links", () => {
    const html = renderToStaticMarkup(createElement(Landing, {
      onPlay: vi.fn(), onScores: vi.fn(), scores: null, busy: false, error: null, plusEnabled: false, plus: false,
    }));
    expect(html).toContain("Unlimited");
    expect(html).toContain("Archive");
    expect(html).not.toContain("/plus");
    expect(html).not.toContain("$5");
    expect(html).not.toContain("Your account");
  });

  it("redirects direct Plus visits home and restores the screen when enabled", () => {
    expect(() => PlusPage()).toThrow("redirect:/");
    state.enabled = true;
    expect(PlusPage().type).toBe(PlusScreen);
  });

  it("retains authenticated history without publishing account prompts or querying purchases", async () => {
    const response = await account(request());
    expect(await response.json()).toMatchObject({ enabled: false, email: null, plus: false, restore: false });
    expect(state.lookup).not.toHaveBeenCalled();
  });

  it("rejects Checkout and confirmation before Stripe or purchase lookups run", async () => {
    expect((await checkout(request())).status).toBe(404);
    expect((await confirm(request())).status).toBe(404);
    expect(state.lookup).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
    expect(state.fulfill).not.toHaveBeenCalled();
  });
});
