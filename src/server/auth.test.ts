import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "./auth";
import { POST as signIn } from "@/app/api/account/sign-in/route";
import { POST as verify } from "@/app/api/account/verify/route";
import { POST as signOut } from "@/app/api/account/sign-out/route";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  getUser: vi.fn(), otp: vi.fn(), verify: vi.fn(), signOut: vi.fn(),
  cookies: [{ name: "sb-fixture-auth-token", value: "fixture" }],
  userId: "0f7f2729-94e9-4896-8904-589b6584963e",
  playerId: "30b5c7f7-1a7a-48f3-9cc7-47f21f6da341",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => state.cookies, set: vi.fn() }) }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: {
    getUser: state.getUser, signInWithOtp: state.otp, verifyOtp: state.verify, signOut: state.signOut,
  } }),
}));
vi.mock("./account-store", () => ({
  linkPlayerAccount: async () => state.playerId, isAccountPlayer: async () => false,
}));

function request(body: object = {}, origin = "http://localhost") {
  return new Request("http://localhost/api/account", {
    method: "POST", headers: { origin, "content-type": "application/json", "x-player-id": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
  state.getUser.mockReset().mockResolvedValue({ data: { user: { id: state.userId, email_confirmed_at: "2026-10-01" } }, error: null });
  state.verify.mockReset().mockResolvedValue({ data: { user: { id: state.userId, email_confirmed_at: "2026-10-01" } }, error: null });
  state.otp.mockReset().mockResolvedValue({ error: null });
  state.signOut.mockReset().mockResolvedValue({ error: null });
  state.cookies = [{ name: "sb-fixture-auth-token", value: "fixture" }];
});

describe("passwordless account routes", () => {
  it("sends an OTP and links only a verified identity", async () => {
    expect((await signIn(request({ email: "player@example.com" }))).status).toBe(200);
    expect(state.otp).toHaveBeenCalledWith({ email: "player@example.com" });
    const response = await verify(request({ email: "player@example.com", token: "123456" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playerId: state.playerId });
    expect(state.verify).toHaveBeenCalledWith({ email: "player@example.com", token: "123456", type: "email" });
    expect((await signOut(request())).status).toBe(200);
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects expired codes, invalid emails and cross-origin sign-in attempts", async () => {
    state.verify.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    expect((await verify(request({ email: "player@example.com", token: "123456" }))).status).toBe(400);
    expect((await signIn(request({ email: "invalid" }))).status).toBe(400);
    expect((await signIn(request({ email: "player@example.com" }, "https://attacker.example"))).status).toBe(400);
    expect(state.getUser).not.toHaveBeenCalled();
    state.otp.mockResolvedValue({ error: { status: 429 } });
    expect((await signIn(request({ email: "player@example.com" }))).status).toBe(429);
  });

  it("never trusts an unverified, expired or missing session", async () => {
    state.cookies = [];
    expect(await currentUser()).toBeNull();
    expect(state.getUser).not.toHaveBeenCalled();
    state.cookies = [{ name: "sb-fixture-auth-token", value: "fixture" }];
    state.getUser.mockResolvedValue({ data: { user: { id: state.userId } }, error: null });
    expect(await currentUser()).toBeNull();
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await currentUser()).toBeNull();
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(currentUser()).rejects.toMatchObject({ code: "not_configured" });
  });
});
