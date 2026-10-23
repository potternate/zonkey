"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client/api";
import { setPlayerId } from "@/lib/client/player-id";

const inputClass = "h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function EmailSignIn({ id, onSignedIn, note }: { id: string; onSignedIn: () => Promise<unknown>; note?: string }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (codeSent) {
        const { playerId } = await api.verify(email.trim(), token.trim());
        setPlayerId(playerId);
        await onSignedIn();
      } else {
        await api.signIn(email.trim());
        setCodeSent(true);
        setMessage("Check your email for your sign-in code.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={`${id}-email`} className="block text-sm font-semibold">Email</label>
      <input id={`${id}-email`} type="email" autoComplete="email" value={email} required maxLength={254}
        readOnly={codeSent || busy} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
      {codeSent && <>
        <label htmlFor={`${id}-code`} className="block text-sm font-semibold">Sign-in code</label>
        <input id={`${id}-code`} autoComplete="one-time-code" inputMode="numeric" value={token} required
          pattern="[0-9]{6,10}" maxLength={10} readOnly={busy} onChange={(event) => setToken(event.target.value)} className={inputClass} />
      </>}
      <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
        {busy ? "One moment…" : codeSent ? "Verify code" : "Continue with email"}<ArrowRight />
      </Button>
      {codeSent && <Button type="button" variant="ghost" disabled={busy} className="w-full"
        onClick={() => { setCodeSent(false); setToken(""); setMessage(null); }}>Change email or resend code</Button>}
      {note && <p className="text-xs leading-5 text-muted-foreground">{note}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
