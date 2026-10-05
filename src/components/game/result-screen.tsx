"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Copy, Flame, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { copyText, shareText } from "@/lib/client/share";
import { buildShareText, gameShareUrl } from "@/lib/game/share";
import type { GameView } from "@/lib/game/types";
import { scoreMode, type PlayerScores } from "@/lib/game/scores";
import { Chain } from "./chain";
import { gameLabel } from "./header";
import { FirstGuesses } from "./first-guesses";
import { DailyResultsChart } from "./daily-results";

export function ResultScreen({
  game, scores, onPlayAgain, onHome, busy, error,
}: {
  game: GameView;
  scores: PlayerScores | null;
  onPlayAgain: () => void;
  onHome: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copyOnly, setCopyOnly] = useState(false);
  const [openSeparately, setOpenSeparately] = useState(false);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const won = game.status === "won";
  const rounds = game.rounds.length;
  const mode = scoreMode(game);

  useEffect(() => {
    setCopyOnly(typeof navigator.share !== "function");
  }, []);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setShareStatus(null);
    setOpenSeparately(false);
    setManualCopy(null);
    const operation = shareText(buildShareText(game), gameShareUrl(game, window.location.origin));
    void api.trackShare(game.id);
    const outcome = await operation;
    setSharing(false);
    if (outcome === "copied") {
      setCopyOnly(true);
      setShareStatus("Copied to clipboard");
    }
    if (outcome === "blocked" && window.self !== window.top) {
      setOpenSeparately(true);
      setShareStatus("Open the game in its own tab to use your phone’s share sheet.");
    } else if (outcome === "blocked" || outcome === "failed") {
      setShareStatus("Sharing unavailable here. Tap Copy result.");
    }
    if (outcome === "blocked" || outcome === "failed") setCopyOnly(true);
  }

  async function handleCopy() {
    if (sharing) return;
    setSharing(true);
    setShareStatus(null);
    setOpenSeparately(false);
    setManualCopy(null);
    const text = buildShareText(game, gameShareUrl(game, window.location.origin));
    const operation = copyText(text);
    void api.trackShare(game.id);
    const outcome = await operation;
    setSharing(false);
    setShareStatus(outcome === "copied" ? "Copied to clipboard" : "Select and copy your result below.");
    setManualCopy(outcome === "failed" ? text : null);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-8 pb-8 text-center">
      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-500">
        <Image src="/zonkey-mark.webp" alt="" width={46} height={60} className="mx-auto h-15 w-12 object-contain" />
        <div className="eyebrow text-muted-foreground">{gameLabel(game.mode, game.puzzleNumber)}</div>
        <h2 className={won ? "animate-pop text-5xl font-bold tracking-[-0.06em] text-success" : "text-4xl font-bold tracking-[-0.06em]"}>
          {won ? "Connected." : "So close."}
        </h2>
        <p className="text-sm text-muted-foreground">
          {won ? `You and Zonkey connected in ${rounds} turn${rounds === 1 ? "" : "s"}.` : `No match in ${game.maxRounds} turns. A new pair awaits.`}
        </p>
        {scores && game.mode === "daily" && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Flame className="size-4 text-primary" aria-hidden="true" />{scores.dailyStreak.current} day streak
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button onClick={copyOnly ? handleCopy : handleShare} disabled={sharing} className="h-14 gap-2 rounded-xl text-base font-semibold">
          {copyOnly ? <Copy className="size-4" /> : <Share2 className="size-4" />}
          {sharing ? copyOnly ? "Copying…" : "Sharing…" : copyOnly ? "Copy result" : "Share result"}
        </Button>
        {mode === "archive" ? (
          <Button asChild variant="outline" className="h-12 gap-2 rounded-xl">
            <Link href="/daily">Play another Archive<ArrowRight className="size-4" /></Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={onPlayAgain} disabled={busy} className="h-12 gap-2 rounded-xl">
            {busy ? "Getting ready…" : mode === "unlimited" ? "Play again" : "Play Unlimited"}<ArrowRight className="size-4" />
          </Button>
        )}
        {openSeparately && (
          <a href={`?game=${encodeURIComponent(game.id)}`} target="_blank" rel="noopener noreferrer" className="py-3 text-sm font-bold underline">
            OPEN GAME TO SHARE
          </a>
        )}
        {manualCopy && (
          <textarea aria-label="Result to copy" readOnly value={manualCopy} onFocus={(event) => event.currentTarget.select()} className="min-h-48 w-full rounded-xl border border-input bg-card p-3 text-base" />
        )}
        {game.mode === "daily" && <p className="text-xs text-muted-foreground">Next Daily at midnight UTC.</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shareStatus}
        </p>
      </div>

      {game.mode === "daily" && game.status !== "active" && (
        <DailyResultsChart key={game.id} gameId={game.id} puzzleNumber={game.puzzleNumber} won={won} rounds={rounds} />
      )}

      <div className="w-full divide-y border-y text-left">
        <details className="group">
          <summary className="flex min-h-12 list-none items-center justify-between gap-3 rounded-sm py-3 text-sm font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2">
            Your word chain<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="pb-4"><Chain game={game} /></div>
        </details>
        {game.firstGuesses && game.rounds[0] && (
          <details className="group">
            <summary className="flex min-h-12 list-none items-center justify-between gap-3 rounded-sm py-3 text-sm font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2">
              First guesses<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="pb-4"><FirstGuesses board={game.firstGuesses} yourWord={game.rounds[0].playerAnswer} /></div>
          </details>
        )}
      </div>
      <Button variant="ghost" className="h-11" onClick={onHome} disabled={busy}>Back to home</Button>
    </div>
  );
}
