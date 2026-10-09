"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Infinity as InfinityIcon, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Account } from "@/lib/client/api";
import { resetPlayerId, setPlayerId } from "@/lib/client/player-id";

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

function returnPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/")) return "/";
  const url = new URL(next, window.location.origin);
  return url.origin === window.location.origin && !url.pathname.startsWith("/plus") ? url.pathname + url.search : "/";
}

export function PlusScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [next, setNext] = useState("/");
  const [confirmRetry, setConfirmRetry] = useState(0);
  useEffect(() => {
    if (account && !account.enabled) window.location.replace(returnPath());
  }, [account]);

  const refresh = useCallback(async () => {
    const value = await api.account();
    if (value.playerId) setPlayerId(value.playerId);
    setAccount(value);
    return value;
  }, []);

  useEffect(() => {
    setNext(returnPath());
    void refresh().catch((err: unknown) => setError(errorMessage(err)));
    if (new URLSearchParams(window.location.search).has("cancelled")) {
      setMessage("Checkout cancelled. You haven't been charged.");
    }
  }, [refresh]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId || !account?.enabled || !account.email || account.plus) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void api.confirmCheckout(sessionId).then(async ({ plus }) => {
      if (cancelled) return;
      if (plus) {
        setBusy(false);
        await refresh();
        setMessage("Payment confirmed. Zonkey Plus is yours.");
      } else {
        setMessage("Your payment hasn't been confirmed yet. Check again in a moment.");
      }
    }).catch((err: unknown) => {
      if (!cancelled) setError(errorMessage(err));
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [account?.enabled, account?.email, account?.plus, confirmRetry, refresh]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (codeSent) {
        const { playerId } = await api.verify(email.trim(), token.trim());
        setPlayerId(playerId);
        await refresh();
      } else {
        await api.signIn(email.trim());
        setCodeSent(true);
        setMessage("Check your email for your sign-in code.");
      }
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.checkout();
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      if (err instanceof ApiError && err.code === "conflict") await refresh();
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await api.signOut();
      resetPlayerId();
      setCodeSent(false);
      setToken("");
      setMessage(null);
      await refresh();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (account && !account.enabled) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:py-10">
      <Link href="/" className="min-h-11 text-3xl font-bold tracking-tight">zonkey</Link>
      <section className="my-auto rounded-3xl border bg-card p-6 sm:p-8">
        <p className="eyebrow text-primary">Zonkey Plus</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.05em]">
          {account?.plus ? "Keep exploring." : "More word safaris."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {account?.plus ? "Your lifetime unlock works wherever you sign in." : "$5 USD once. Unlimited and Archive, yours for life."}
        </p>
        <ul className="my-6 space-y-3 text-sm">
          <li className="flex items-center gap-3"><InfinityIcon className="size-5 text-primary" />Fresh Unlimited games</li>
          <li className="flex items-center gap-3"><Archive className="size-5 text-primary" />Every past Daily in the Archive</li>
        </ul>
        {account?.plus ? (
          <div className="space-y-3">
            <Button asChild className="h-12 w-full rounded-xl"><Link href={next}>Back to playing<ArrowRight /></Link></Button>
            <Button asChild variant="outline" className="h-12 w-full rounded-xl"><Link href="/daily">Explore Archive</Link></Button>
          </div>
        ) : account?.enabled && account.email ? (
          <Button onClick={() => void buy()} disabled={busy} className="h-12 w-full rounded-xl">
            {busy ? "Checking…" : "Unlock for $5 once"}<ArrowRight />
          </Button>
        ) : account?.enabled ? (
          <form onSubmit={signIn} className="space-y-3">
            <label htmlFor="plus-email" className="block text-sm font-semibold">Email</label>
            <input id="plus-email" type="email" autoComplete="email" value={email} required maxLength={254}
              readOnly={codeSent || busy} onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            {codeSent && <>
              <label htmlFor="plus-code" className="block text-sm font-semibold">Sign-in code</label>
              <input id="plus-code" autoComplete="one-time-code" inputMode="numeric" value={token} required
                pattern="[0-9]{6,10}" maxLength={10} readOnly={busy} onChange={(event) => setToken(event.target.value)}
                className="h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </>}
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
              {busy ? "One moment…" : codeSent ? "Verify code" : "Continue with email"}<ArrowRight />
            </Button>
            {codeSent && <Button type="button" variant="ghost" disabled={busy} className="w-full"
              onClick={() => { setCodeSent(false); setToken(""); setMessage(null); }}>Change email or resend code</Button>}
            <p className="text-xs leading-5 text-muted-foreground">Already bought Plus? Sign in with the same email to restore access.</p>
          </form>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">Loading your account…</p>
        )}
        {account?.email && <div className="mt-5 text-center text-xs text-muted-foreground">
          <p className="break-all">{account.email}</p>
          <Button variant="ghost" disabled={busy} onClick={() => void signOut()} className="mt-1 min-h-11">Sign out</Button>
        </div>}
        {message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {(message || error) && account?.email && !account.plus && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("session_id") &&
          <Button variant="ghost" disabled={busy} className="mt-3 w-full" onClick={() => setConfirmRetry((value) => value + 1)}>Check payment again</Button>}
        {!account && error && <Button variant="ghost" onClick={() => void refresh().catch((err: unknown) => setError(errorMessage(err)))}>Try again</Button>}
        {account?.restore && <p className="mt-4 text-xs leading-5 text-muted-foreground">Sign in to restore your saved scores, or play Daily with a fresh profile below.</p>}
        <Link href="/" onClick={() => { if (account?.restore) resetPlayerId(); }}
          className="mt-5 flex min-h-11 items-center justify-center text-sm text-primary underline underline-offset-4">Play Daily free</Link>
      </section>
    </main>
  );
}
