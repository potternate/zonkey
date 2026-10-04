"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import type { DailyResults } from "@/lib/game/daily-results";

export function DailyResultsChart({
  gameId, puzzleNumber, won, rounds,
}: {
  gameId: string;
  puzzleNumber: number | null;
  won: boolean;
  rounds: number;
}) {
  const [results, setResults] = useState<DailyResults | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getDailyResults(gameId).then(({ results: next }) => {
      if (!cancelled) setResults(next);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [gameId, refresh]);

  function reload() {
    setError(false);
    setLoading(true);
    setRefresh((previous) => previous + 1);
  }

  const rows = results ? [
    ...results.distribution.map((bucket) => ({
      label: String(bucket.rounds), count: bucket.count, yours: won && bucket.rounds === rounds,
    })),
    { label: "No match", count: results.failed, yours: !won },
  ] : [];
  const largest = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="w-full space-y-5 rounded-2xl border bg-card p-5 text-left" aria-labelledby="daily-results-title">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="daily-results-title" className="eyebrow">Daily{puzzleNumber !== null ? ` #${puzzleNumber}` : ""} results</h3>
          {results && <p className="text-xs text-muted-foreground">{results.totalPlayers.toLocaleString("en-US")} player{results.totalPlayers === 1 ? "" : "s"} finished</p>}
        </div>
        {(results || error) && <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>{loading ? "Updating…" : error ? "Retry" : "Refresh"}</Button>}
      </div>

      {loading && !results && <p className="text-sm text-muted-foreground" role="status">Loading everyone&rsquo;s results…</p>}
      {error && <p className="text-sm text-muted-foreground" role="alert">Couldn&rsquo;t load Daily results. Your score is saved. Tap Retry.</p>}
      {results && (
        <>
          <p className="text-lg leading-snug" aria-live="polite">
            {results.betterThanPercent === null ? (
              <>You&rsquo;re the first to finish.<span className="mt-1 block text-sm text-muted-foreground">Check back as more players finish.</span></>
            ) : (
              <>You did better than <strong className="font-bold text-[#42652f]">{results.betterThanPercent}%</strong> of players.</>
            )}
          </p>
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground">Turns to connect</p>
            <ol className="space-y-2" aria-label="Daily turn distribution">
              {rows.map((row) => (
                <li key={row.label} className="flex items-center gap-2 text-xs" aria-label={`${row.label}: ${row.count} player${row.count === 1 ? "" : "s"}${row.yours ? ", including you" : ""}`}>
                  <span className="w-14 shrink-0 font-bold">{row.label}</span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted" aria-hidden="true">
                    <div className={`h-full rounded-md ${row.yours ? "bg-[#42652f]" : "bg-foreground/55"}`} style={{ width: `${row.count ? Math.max(2, row.count / largest * 100) : 0}%` }} />
                    {row.yours && <span className="absolute inset-y-0 right-2 flex items-center"><span className="rounded bg-card px-1 py-0.5 text-[10px] font-bold">YOU</span></span>}
                  </div>
                  <span className="min-w-8 shrink-0 text-right font-bold tabular-nums">{row.count.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Compared with other players who finished this Daily. Fewer turns is better; ties aren&rsquo;t beaten.</p>
        </>
      )}
    </section>
  );
}
