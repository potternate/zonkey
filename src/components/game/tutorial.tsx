"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DAILY_POINTS } from "@/lib/game/daily-run";
import { GameHeader } from "./header";
import { RevealScreen } from "./reveal-screen";
import { RoundScreen } from "./round-screen";
import { ZonkeyReaction } from "./zonkey-reaction";

const DONE_KEY = "zonkey-tutorial-done";
const OPENING = "sun";
const ZONKEY_OPENING = "ocean";
const ZONKEY_CONNECTION = "beach";
const CONNECTS = new Set(["beach", "beaches", "shore", "seashore", "seaside", "coast", "coastline", "sand", "sandy"]);
const NEAR = new Set(["water", "sea", "wave", "waves", "summer", "vacation", "tan", "swim", "swimming", "surf", "tide", "heat", "hot", "sunset", "sunrise", "island", "tropical", "light", "warm", "blue"]);

type Step =
  | { kind: "open" }
  | { kind: "reveal1" }
  | { kind: "connect" }
  | { kind: "reveal2"; word: string; matched: boolean }
  | { kind: "done"; matched: boolean };

const STEP_NUMBER: Record<Step["kind"], number> = { open: 1, reveal1: 1, connect: 2, reveal2: 2, done: 3 };

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** A scripted practice round that runs entirely in the browser. */
export function Tutorial({ onHome, onPlayDaily }: { onHome: () => void; onPlayDaily: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "open" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step.kind !== "done") return;
    try { localStorage.setItem(DONE_KEY, "1"); } catch {}
  }, [step.kind]);

  const header = <GameHeader round={STEP_NUMBER[step.kind]} maxRounds={3} label="TUTORIAL" roundLabel={`Step ${STEP_NUMBER[step.kind]} / 3`} summary="Practice · no score" />;
  const noop = () => undefined;

  if (step.kind === "open") return (
    <>
      {header}
      <ZonkeyReaction className="mt-4" line={`I've secretly picked a word. Type "${OPENING.toUpperCase()}" and we'll reveal both at once.`} />
      <RoundScreen round={{ number: 1, wordA: "", wordB: "", ready: true, opening: true }} submitting={false} preparing={false} prepareError={null}
        submitError={error} onRetryPrepare={noop} onSubmit={(word) => {
          if (word !== OPENING) { setError(`For this tutorial, type "${OPENING}". In real games any word works.`); return; }
          setError(null); setStep({ kind: "reveal1" });
        }} />
    </>
  );

  if (step.kind === "reveal1") return (
    <>
      {header}
      <RevealScreen reveal={{ roundNumber: 1, playerAnswer: OPENING, aiAnswer: ZONKEY_OPENING, matched: false }} gameOver={false}
        continueLabel="Next guess →" onContinue={() => setStep({ kind: "connect" })} />
    </>
  );

  if (step.kind === "connect") return (
    <>
      {header}
      <ZonkeyReaction className="mt-4" line="Different words become the new pair. Now we both think of a word that links them. Synonyms count from here!" />
      <RoundScreen round={{ number: 2, wordA: OPENING, wordB: ZONKEY_OPENING, ready: true }} submitting={false} preparing={false} prepareError={null}
        submitError={null} onRetryPrepare={noop} onSubmit={(word) => setStep({ kind: "reveal2", word, matched: CONNECTS.has(word) })} />
    </>
  );

  if (step.kind === "reveal2") return (
    <>
      {header}
      <RevealScreen
        reveal={{ roundNumber: 2, playerAnswer: step.word, aiAnswer: ZONKEY_CONNECTION, matched: step.matched, ...(step.matched ? {} : { closeness: NEAR.has(step.word) ? 62 : 22 }) }}
        gameOver={step.matched} resultText={step.matched ? `Guess 2 connection: +${DAILY_POINTS[1]} points` : undefined}
        continueLabel="Finish tutorial →" onContinue={() => setStep({ kind: "done", matched: step.matched })} />
    </>
  );

  return (
    <>
      {header}
      <div className="flex flex-1 flex-col gap-5 pt-6 animate-in fade-in duration-300">
        <ZonkeyReaction line={step.matched ? "Natural! You're ready for the real thing." : "Misses are fine: the meter tells you how close you were. You'd keep going from there."} />
        <ul className="space-y-3 border bg-card p-5 text-sm leading-relaxed">
          <li><span className="text-primary">▸</span> Every game has <b>3 rounds</b> with <b>5 guesses</b> each.</li>
          <li><span className="text-primary">▸</span> Connect sooner for more points: {DAILY_POINTS.map((p) => p.toLocaleString("en-US")).join(" · ")}.</li>
          <li><span className="text-primary">▸</span> A miss makes a new pair. The <b>How close</b> meter hints which way to go.</li>
          <li><span className="text-primary">▸</span> Everyone gets the same Daily. Come back each day for your streak.</li>
        </ul>
        <Button onClick={onPlayDaily} className="h-auto min-h-16 w-full gap-3 px-4 py-3 text-[clamp(1.05rem,5vw,1.25rem)] leading-tight whitespace-normal">
          <span aria-hidden="true">▶</span>Play today&rsquo;s Daily<span aria-hidden="true">◀</span>
        </Button>
        <Button variant="ghost" onClick={onHome} className="h-11">Back to home</Button>
      </div>
    </>
  );
}

/** Landing nudge for players who haven't tried the tutorial yet. */
export function TutorialNudge({ onTutorial }: { onTutorial: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!tutorialDone()), []);
  if (!show) return null;
  return (
    <button type="button" onClick={onTutorial} className="mx-auto inline-flex min-h-11 items-center gap-2 text-sm text-primary underline underline-offset-4">
      New here? Play the 1-minute tutorial
    </button>
  );
}
