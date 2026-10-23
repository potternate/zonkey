"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Account } from "@/lib/client/api";
import { resetPlayerId, setPlayerId } from "@/lib/client/player-id";
import { EmailSignIn } from "./email-sign-in";

export function AccountScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const value = await api.account();
    if (value.playerId) setPlayerId(value.playerId);
    setAccount(value);
    return value;
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Something went wrong. Try again."));
  }, [refresh]);

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await api.signOut();
      resetPlayerId();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  const signedIn = Boolean(account?.email);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6 sm:py-10">
      <Link href="/" className="min-h-11 text-3xl font-bold tracking-tight">zonkey</Link>
      <section className="my-auto rounded-3xl border bg-card p-6 sm:p-8">
        <p className="eyebrow text-primary">Free account</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.05em]">{signedIn ? "You're signed in." : "Save your safari."}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {signedIn ? "Your scores and Daily streak are saved to this account." : "No payment needed. Sign in with your email to keep your progress."}
        </p>
        <ul className="my-6 space-y-3 text-sm">
          <li className="flex items-center gap-3"><Flame className="size-5 text-primary" />Keep your scores and Daily streak</li>
          <li className="flex items-center gap-3"><Smartphone className="size-5 text-primary" />Pick up on any device</li>
        </ul>
        {!account && !error && <p role="status" className="text-sm text-muted-foreground">Loading your account…</p>}
        {account && !signedIn && (account.accounts
          ? <EmailSignIn id="account" onSignedIn={refresh} note={account.restore ? "This browser's scores belong to an account. Sign in to restore them." : undefined} />
          : <p className="text-sm text-muted-foreground">Accounts aren&rsquo;t available right now. Your scores are still saved in this browser.</p>)}
        {account && signedIn && (
          <div className="space-y-3">
            <Button asChild className="h-12 w-full rounded-xl"><Link href="/">Back to playing<ArrowRight /></Link></Button>
            {account.enabled && (
              <Button asChild variant="outline" className="h-12 w-full rounded-xl">
                <Link href="/plus">{account.plus ? "Zonkey Plus unlocked" : "Unlimited + Archive · $5 once"}</Link>
              </Button>
            )}
            <div className="pt-2 text-center text-xs text-muted-foreground">
              <p className="break-all">{account.email}</p>
              <Button variant="ghost" disabled={busy} onClick={() => void signOut()} className="mt-1 min-h-11">Sign out</Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {!account && error && <Button variant="ghost" onClick={() => void refresh().catch(() => undefined)}>Try again</Button>}
        {!signedIn && <Link href="/" onClick={() => { if (account?.restore) resetPlayerId(); }}
          className="mt-5 flex min-h-11 items-center justify-center text-sm text-primary underline underline-offset-4">
          {account?.restore ? "Play with a fresh profile" : "Keep playing without an account"}
        </Link>}
      </section>
    </main>
  );
}
