"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
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
    inputRef.current?.focus();
  }, [round.number]);

  useEffect(() => {
    if (submitError) setShakeKey((k) => k + 1);
  }, [submitError]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
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
    <div key={round.number} className="flex flex-1 flex-col gap-4 pt-3 animate-in fade-in duration-300">
      <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border bg-card px-4 py-5 text-center">
        <BigWord word={round.wordA} className="text-[clamp(1.35rem,5.5vw,2.25rem)]" />
        <span className="text-xl text-primary" aria-hidden="true">↔</span>
        <BigWord word={round.wordB} className="text-[clamp(1.35rem,5.5vw,2.25rem)]" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="your-word" className="sr-only">Your connection</label>
        <div key={shakeKey} className={cn(shakeKey > 0 && error && "animate-shake")}>
          <Input
            ref={inputRef}
            id="your-word"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLocalError(null);
            }}
            readOnly={submitting}
            placeholder="Your connecting word"
            aria-label="Your word"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "word-feedback" : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={40}
            className="h-18 rounded-2xl border-2 bg-card px-5 text-2xl font-semibold caret-primary placeholder:text-base placeholder:font-normal focus-visible:ring-4 md:text-2xl"
          />
        </div>
        <Button
          type="submit"
          aria-busy={submitting}
          disabled={submitting || !value.trim()}
          className="h-14 justify-between rounded-2xl px-5 text-base font-semibold shadow-sm"
        >
          {submitting ? ready ? "Checking…" : "Waiting for AI…" : "Connect"}
          {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}
        </Button>
        <div id="word-feedback" className="text-center text-sm" aria-live="polite">
          {submitting && <p className="sr-only">{ready ? "Checking your word." : "Your word is submitted. Waiting for the AI."}</p>}
          {error && <p className="text-destructive">{error}</p>}
          {!ready && prepareError && !submitting && !error && (
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
