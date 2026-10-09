"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/client/api";
import { DAILY_POINTS } from "@/lib/game/daily-run";
import type { DailyRunView } from "@/lib/game/daily-run";
import type { FirstGuessBoard } from "@/lib/game/first-guesses";
import type { Reveal } from "@/lib/game/types";
import { GameHeader } from "./header";
import { RoundScreen } from "./round-screen";
import { RevealScreen } from "./reveal-screen";
import { DailyResult } from "./daily-result";
import { THEME_LABELS, type UnlimitedTheme } from "@/lib/game/themes";

function messageOf(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Try again.";
}

export function DailyGame({ date, id, mode = "daily", theme, onHome, onUnlimited, onProgress }: {
  date?: string; onHome: () => void; onUnlimited: () => void; onProgress: () => void;
  id?: string; mode?: "daily" | "unlimited"; theme?: UnlimitedTheme;
}) {
  const [run, setRun] = useState<DailyRunView | null>(null);
  const [reveal, setReveal] = useState<{ round: number; reveal: Reveal; firstGuesses?: FirstGuessBoard } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [requestId] = useState(() => crypto.randomUUID());
  const [prepareRetry, setPrepareRetry] = useState(0);
  const runId = run?.id;
  const roundNumber = run?.current?.round;
  const guessNumber = run?.current?.guess;

  useEffect(() => {
    let cancelled = false;
    const start = id ? api.getDaily(id) : mode === "unlimited" ? api.startUnlimited(theme, requestId) : api.startDaily(date);
    start.then(({ run: next }) => {
      if (!cancelled) {
        setRun(next); setLoadError(null);
        if (next.mode === "unlimited") window.history.replaceState(null, "", `/?run=${next.id}`);
      }
    }).catch((err: unknown) => {
      if (!cancelled) setLoadError(messageOf(err));
    });
    return () => { cancelled = true; };
  }, [date, id, mode, theme, requestId, loadRetry]);

  useEffect(() => {
    if (run?.status === "completed") onProgress();
  }, [run?.status, onProgress]);

  useEffect(() => {
    if (!runId || !roundNumber || !guessNumber) {
      setPreparing(false);
      return;
    }
    let cancelled = false;
    setPreparing(true);
    setPrepareError(null);
    api.prepareDaily(runId).then(({ run: next }) => {
      if (!cancelled) setRun((previous) => previous?.id === next.id
        && previous.current?.round === roundNumber && previous.current?.guess === guessNumber
        && next.current?.round === roundNumber && next.current?.guess === guessNumber ? next : previous);
    }).catch((err: unknown) => {
      if (!cancelled) setPrepareError(messageOf(err));
    }).finally(() => {
      if (!cancelled) setPreparing(false);
    });
    return () => { cancelled = true; };
  }, [runId, roundNumber, guessNumber, prepareRetry]);

  async function submit(answer: string) {
    if (!run?.current || submitting) return;
    const { round, guess } = run.current;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.submitDaily(run.id, round, guess, answer);
      setRun(result.run);
      setReveal({ round, reveal: result.reveal, firstGuesses: result.firstGuesses });
    } catch (err) {
      if (err instanceof ApiError && err.code === "conflict") {
        try {
          const { run: fresh } = await api.getDaily(run.id);
          setRun(fresh);
          setReveal(null);
        } catch (refreshError) { setSubmitError(messageOf(refreshError)); }
      } else setSubmitError(messageOf(err));
    } finally { setSubmitting(false); }
  }

  if (!run) return (
    <div className="space-y-4 py-12 text-center">
      {loadError ? <><p role="alert" className="text-destructive">{loadError}</p><Button onClick={() => setLoadRetry((value) => value + 1)}>Try again</Button></> :
        <p role="status" className="text-muted-foreground">Getting your five rounds ready…</p>}
      <Button variant="ghost" onClick={onHome}>Back to home</Button>
    </div>
  );
  if (run.status === "completed" && !reveal) return <DailyResult run={run} onHome={onHome} onUnlimited={onUnlimited} />;
  const displayRound = reveal?.round ?? run.current?.round ?? 5;
  const finishedRound = run.rounds[displayRound - 1];
  return (
    <>
      <GameHeader round={displayRound} maxRounds={5} label={run.mode === "unlimited" ? `UNLIMITED${run.theme ? ` · ${THEME_LABELS[run.theme]}` : ""}` : `${run.mode === "archive" ? "ARCHIVE" : "DAILY"} #${run.puzzleNumber}`} summary={`${run.score.toLocaleString("en-US")} / 5,000 pts`} />
      {!reveal && run.current && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">Guess {run.current.guess} / 5 · {DAILY_POINTS[run.current.guess - 1]} pts</p>
          <RoundScreen key={`${run.current.round}:${run.current.guess}`} round={{
            number: run.current.guess, wordA: run.current.wordA, wordB: run.current.wordB, ready: run.current.ready,
            opening: run.current.opening,
          }} submitting={submitting} preparing={preparing} prepareError={prepareError} submitError={submitError}
          onRetryPrepare={() => setPrepareRetry((value) => value + 1)} onSubmit={submit} />
        </>
      )}
      {reveal && (
        <RevealScreen key={`${reveal.round}:${reveal.reveal.roundNumber}`} reveal={reveal.reveal} firstGuesses={reveal.firstGuesses}
          gameOver={finishedRound.status !== "active"}
          resultText={finishedRound.status !== "active" ? `Round ${displayRound}: ${finishedRound.score} points` : undefined}
          continueLabel={run.status === "completed" ? "See your score" : finishedRound.status !== "active" ? `Round ${displayRound + 1} →` : "Next guess →"}
          onContinue={() => setReveal(null)} />
      )}
    </>
  );
}
