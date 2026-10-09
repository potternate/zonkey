"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, api, type Account } from "@/lib/client/api";
import type { PlayerScores } from "@/lib/game/scores";
import { cn } from "@/lib/utils";
import { Landing } from "./landing";
import { ScoresScreen } from "./scores-screen";
import { BrandHeader } from "./brand-header";
import { DailyGame } from "./daily-game";
import { UnlimitedPicker } from "./unlimited-picker";
import type { UnlimitedTheme } from "@/lib/game/themes";

type Phase = "landing" | "scores" | "play" | "unlimited";

export function Zonkey({ children }: { children?: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("landing");
  const [play, setPlay] = useState<{ mode: "daily" | "unlimited"; date?: string; theme?: UnlimitedTheme; id?: string }>({ mode: "daily" });
  const [scores, setScores] = useState<PlayerScores | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [scoresError, setScoresError] = useState<string | null>(null);

  const refreshScores = useCallback(async () => {
    try {
      const { scores: next } = await api.getScores();
      setScores(next);
      setScoresError(null);
    } catch (err) {
      setScoresError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    void refreshScores();
    void api.account().then(setAccount).catch(() => undefined);
    window.addEventListener("focus", refreshScores);
    return () => window.removeEventListener("focus", refreshScores);
  }, [refreshScores]);

  useEffect(() => {
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 1, 0);
    const timer = window.setTimeout(() => void refreshScores(), midnight.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [refreshScores, scores?.dailyDate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("run");
    const date = params.get("daily");
    if (id) { setPlay({ mode: "unlimited", id }); setPhase("play"); }
    else if (date !== null) { setPlay({ mode: "daily", date }); setPhase("play"); }
  }, []);

  const goHome = () => {
    setPhase("landing");
    window.history.replaceState(null, "", window.location.pathname);
    void refreshScores();
  };
  const openDaily = (date?: string) => { setPlay({ mode: "daily", date }); setPhase("play"); };
  const chooseUnlimited = () => setPhase("unlimited");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10">
      <BrandHeader onHome={goHome} onScores={() => { setPhase("scores"); void refreshScores(); }} home={phase === "landing"} disabled={false} />
      <div className={cn("flex w-full flex-1 flex-col", phase !== "landing" && "mx-auto max-w-lg")}>
        {phase === "play" && <DailyGame key={play.id ?? `${play.mode}:${play.date ?? "today"}:${play.theme ?? "all"}`} {...play} onHome={goHome} onUnlimited={chooseUnlimited} onProgress={refreshScores} />}
        {phase === "landing" && <Landing onPlay={(mode) => mode === "unlimited" ? chooseUnlimited() : openDaily()} onScores={() => setPhase("scores")} scores={scores} busy={false} error={null} plusEnabled={account?.enabled ?? false} plus={account?.plus ?? false} />}
        {phase === "unlimited" && <UnlimitedPicker onChoose={(theme) => { setPlay({ mode: "unlimited", theme: theme ?? undefined }); setPhase("play"); }} onHome={goHome} busy={false} error={null} />}
        {phase === "scores" && <ScoresScreen scores={scores} error={scoresError} onHome={goHome} onRetry={refreshScores} onResult={(id) => { setPlay({ mode: "unlimited", id }); setPhase("play"); }} onDailyResult={openDaily} />}
      </div>
      {phase === "landing" && children}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[11px] text-muted-foreground sm:mt-14">
        <span className="font-mono tracking-wide">zonkey.io</span>
        <div className="flex items-center gap-4">
          {account?.enabled && <a href="/plus" className="inline-flex min-h-11 items-center underline underline-offset-4">{account.plus ? "Your account" : "Zonkey Plus"}</a>}
          <a href="https://github.com/potternate/zonkey" target="_blank" rel="noopener noreferrer" aria-label="View Zonkey on GitHub (opens in a new tab)" className="inline-flex min-h-11 items-center gap-1 rounded-sm underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
