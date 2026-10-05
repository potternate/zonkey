"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/client/api";
import { archiveCalendarMonth, dailyArchiveEntry, formatArchiveDate } from "@/lib/game/archive";
import { DAILY_EPOCH, MAX_ROUNDS } from "@/lib/game/config";
import type { PlayerScores, SavedDailyEntry } from "@/lib/game/scores";
import { cn } from "@/lib/utils";

function resultLabel(game: SavedDailyEntry | undefined): string {
  if (!game) return "Play";
  if (game.status === "active") return "Resume";
  return game.status === "won" ? `${game.rounds}/${MAX_ROUNDS}` : `X/${MAX_ROUNDS}`;
}

function puzzleHref(date: string, game: SavedDailyEntry | undefined): string {
  return game ? `/?game=${encodeURIComponent(game.id)}` : `/?daily=${date}`;
}

export function ArchiveBrowser({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [scores, setScores] = useState<PlayerScores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const { scores: next } = await api.getScores();
      setScores(next);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your saved games.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 1, 0);
    const timer = window.setTimeout(() => void refresh(), midnight.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [refresh, scores?.dailyDate]);

  const dailyDate = scores?.dailyDate ?? today;
  const calendar = archiveCalendarMonth(month);
  if (!calendar) return null;
  const saved = new Map(scores?.savedDailies.map((game) => [game.date, game]));
  const pastDates = calendar.days.filter((date): date is string =>
    date !== null && date >= DAILY_EPOCH && date < dailyDate,
  ).reverse();
  const ready = scores !== null && error === null;

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <section className="rounded-3xl border bg-card p-4 sm:p-6" aria-label="Past Daily puzzle calendar">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" className="size-11" aria-label="Previous month" disabled={month <= DAILY_EPOCH.slice(0, 7)} onClick={() => setMonth(calendar.previous)}>
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-lg font-bold tracking-tight" aria-live="polite">{calendar.label}</h2>
          <Button variant="ghost" className="size-11" aria-label="Next month" disabled={month >= dailyDate.slice(0, 7)} onClick={() => setMonth(calendar.next)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendar.days.map((date, index) => {
            if (date === null) return <span key={`blank-${index}`} aria-hidden="true" />;
            const available = date >= DAILY_EPOCH && date < dailyDate;
            const game = saved.get(date);
            const label = resultLabel(game);
            const className = cn(
              "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold",
              available ? "border-border bg-background" : "border-transparent text-muted-foreground/40",
              game?.status === "won" && "border-success-border bg-success-muted text-success",
              game?.status === "lost" && "bg-muted text-muted-foreground",
              game?.status === "active" && "border-primary/40 text-primary",
            );
            const content = <><span>{Number(date.slice(-2))}</span><span className="text-[9px] font-medium">{date === dailyDate ? "Today" : available ? label : "\u00a0"}</span></>;
            return available && ready ? (
              <Link key={date} href={puzzleHref(date, game)} aria-label={`${formatArchiveDate(date)}: ${game?.status === "won" ? `Connected in ${game.rounds} turns. View result` : game?.status === "lost" ? "Played without a match. View result" : label}`} className={cn(className, "transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2")}>
                {content}
              </Link>
            ) : <span key={date} className={className} aria-label={formatArchiveDate(date)}>{content}</span>;
          })}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">Tap a day to play, resume, or view your result.</p>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => void refresh()}>Reload saved games</Button>
        </div>
      ) : !scores && <p className="text-center text-sm text-muted-foreground" role="status">Loading your saved games…</p>}

      <section aria-labelledby="archive-puzzles">
        <h2 id="archive-puzzles" className="mb-3 text-sm font-semibold text-muted-foreground">{calendar.label} puzzles</h2>
        {pastDates.length === 0 && <p className="text-sm text-muted-foreground">No past puzzles this month yet. Come back after the next Daily.</p>}
        <ol className="divide-y border-y">
          {pastDates.map((date) => {
            const entry = dailyArchiveEntry(date, new Date(`${dailyDate}T00:00:00Z`));
            if (!entry) return null;
            const game = saved.get(date);
            const label = resultLabel(game);
            return (
              <li key={date} className="flex min-h-16 items-center gap-3 py-2">
                <Link href={`/daily/${date}`} className="min-w-0 flex-1 rounded-sm py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="block text-sm font-semibold">Daily #{entry.number}</span>
                  <time dateTime={date} className="mt-0.5 block text-xs text-muted-foreground">{formatArchiveDate(date)}</time>
                </Link>
                {ready ? (
                  <Button asChild variant={game && game.status !== "active" ? "outline" : "default"} className="min-h-10 rounded-xl px-4">
                    <Link href={puzzleHref(date, game)} aria-label={`${game && game.status !== "active" ? "View result" : label} for Daily #${entry.number}`}>{label}</Link>
                  </Button>
                ) : <Button disabled className="min-h-10 rounded-xl px-4">Loading…</Button>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
