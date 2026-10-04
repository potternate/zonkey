"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateAnswer } from "@/lib/game/normalize";
import type { CurrentRoundView } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { BigWord } from "./word";

interface Props {
  round: CurrentRoundView;
  submitting: boolean;
  preparing: boolean;
  prepareError: string | null;
  submitError: string | null;
  onRetryPrepare: () => void;
  onSubmit: (answer: string) => void;
}

export function RoundScreen({ round, submitting, preparing, prepareError, submitError, onRetryPrepare, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = round.ready;
  const error = localError ?? submitError;

  useEffect(() => {
    setValue("");
    setLocalError(null);
  }, [round.number]);

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready, round.number]);

  useEffect(() => {
    if (submitError) setShakeKey((k) => k + 1);
  }, [submitError]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    const check = validateAnswer(value, [round.wordA, round.wordB]);
    if (!check.ok) {
      setLocalError(check.error);
      setShakeKey((k) => k + 1);
      return;
    }
    setLocalError(null);
    onSubmit(check.word);
  }

  return (
    <div key={round.number} className="flex flex-1 flex-col gap-6 pt-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="daily-card relative isolate flex min-w-0 flex-col items-center gap-5 overflow-hidden rounded-[2rem] border bg-card px-6 py-8 text-center [&>*]:relative [&>*]:z-10">
        <span className="eyebrow text-primary">Find the connection</span>
        <BigWord word={round.wordA} />
        <div className="flex w-full items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-border" /><span className="flex size-9 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-lg text-primary">↔</span><span className="h-px flex-1 bg-border" /></div>
        <BigWord word={round.wordB} />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold tracking-tight">What brings these two together?</p>
        {round.number === 1 && <p className="text-xs leading-6 text-muted-foreground">Find the word you&rsquo;re both thinking.</p>}
        {round.number > 1 && <p className="text-xs leading-6 text-muted-foreground">Same meaning counts. Synonyms can connect.</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="your-word" className="eyebrow text-muted-foreground">Your connection</label>
        <div key={shakeKey} className={cn(shakeKey > 0 && error && "animate-shake")}>
          <Input
            ref={inputRef}
            id="your-word"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLocalError(null);
            }}
            disabled={!ready || submitting}
            placeholder={ready ? "One word. Go with your gut." : "AI is choosing…"}
            aria-label="Your word"
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={40}
            className="h-16 rounded-2xl border bg-card px-5 text-lg font-medium placeholder:text-sm dark:bg-card md:text-lg"
          />
        </div>
        <Button
          type="submit"
          disabled={!ready || submitting || !value.trim()}
          className="h-14 justify-between rounded-2xl px-5 text-base font-semibold shadow-sm"
        >
          {submitting ? "Connecting…" : ready ? "Make the connection" : "Thinking…"}<ArrowRight className="size-5" />
        </Button>
        {ready && <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="size-3" /> The AI&rsquo;s word is locked in. Your turn.</p>}
        <div className="min-h-6 text-center text-sm" aria-live="polite">
          {error && <p className="text-destructive">{error}</p>}
          {!ready && prepareError && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-destructive">{prepareError}</p>
              <Button variant="outline" onClick={onRetryPrepare} disabled={preparing} type="button" className="h-10 rounded-xl px-5 font-bold">
                {preparing ? "RETRYING…" : "TRY AGAIN"}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
