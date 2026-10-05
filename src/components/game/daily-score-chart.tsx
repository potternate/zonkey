"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import type { DailyScoreResults } from "@/lib/game/daily-run";

export function DailyScoreChart({ id, score }: { id: string; score: number }) {
  const [results, setResults] = useState<DailyScoreResults | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.dailyResults(id).then(({ results: next }) => {
      if (!cancelled) setResults(next);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, refresh]);

  const largest = Math.max(1, ...results?.distribution.map((bucket) => bucket.count) ?? []);
  const points = results?.distribution.map((bucket) => ({
    x: 10 + bucket.score / 5000 * 500,
    y: 148 - bucket.count / largest * 110,
  })) ?? [];
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const own = results?.distribution.find((bucket) => bucket.score === score);
  const ownX = 10 + score / 5000 * 500;
  const ownY = 148 - (own?.count ?? 0) / largest * 110;

  return (
    <section className="w-full space-y-4 rounded-2xl border bg-card p-5 text-left" aria-labelledby="score-distribution-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="score-distribution-title" className="eyebrow">Daily score distribution</h3>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => {
          setError(false); setLoading(true); setRefresh((value) => value + 1);
        }}>{loading ? "Loading…" : error ? "Retry" : "Refresh"}</Button>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">Couldn&rsquo;t load results. Your score is saved.</p>}
      {results && (
        <>
          <p className="text-lg" aria-live="polite">
            {results.betterThanPercent === null ? "You’re the first to finish. Check back as more players finish." :
              <>You did better than <strong className="text-success">{results.betterThanPercent}%</strong> of players.</>}
          </p>
          <p className="text-xs text-muted-foreground">{results.totalPlayers.toLocaleString("en-US")} player{results.totalPlayers === 1 ? "" : "s"} finished</p>
          <svg viewBox="0 0 520 180" role="img" aria-labelledby="score-chart-title score-chart-description" className="w-full overflow-visible">
            <title id="score-chart-title">Completed Daily scores from 0 to 5,000</title>
            <desc id="score-chart-description">Actual player counts at each score. Your score is {score}. Counts are available in the table below.</desc>
            <line x1="10" x2="510" y1="148" y2="148" className="stroke-border" />
            <path d={`M 10,148 L ${line} L 510,148 Z`} className="fill-primary/15" />
            <polyline points={line} fill="none" className="stroke-primary" strokeWidth="2" />
            <line x1={ownX} x2={ownX} y1="15" y2="148" className="stroke-success" strokeDasharray="4 4" />
            <circle cx={ownX} cy={ownY} r="5" className="fill-success" />
            <text x="10" y="172" fontSize="12" className="fill-muted-foreground">0</text>
            <text x="260" y="172" textAnchor="middle" fontSize="12" className="fill-muted-foreground">2,500</text>
            <text x="510" y="172" textAnchor="end" fontSize="12" className="fill-muted-foreground">5,000</text>
          </svg>
          <p className="text-xs text-success">Your score: {score.toLocaleString("en-US")}</p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">View score counts</summary>
            <table className="w-full text-sm">
              <caption className="sr-only">Daily score distribution</caption>
              <thead><tr><th scope="col" className="py-2 text-left">Points</th><th scope="col" className="text-right">Players</th></tr></thead>
              <tbody>{results.distribution.map((bucket) => (
                <tr key={bucket.score} className={bucket.score === score ? "font-bold text-success" : ""}>
                  <th scope="row" className="py-1 text-left font-normal">{bucket.score.toLocaleString("en-US")}{bucket.score === score ? " · You" : ""}</th>
                  <td className="text-right tabular-nums">{bucket.count}</td>
                </tr>
              ))}</tbody>
            </table>
          </details>
          <p className="text-xs leading-relaxed text-muted-foreground">Actual scores for this Daily. Higher is better; ties aren&rsquo;t beaten. Archive and unfinished games aren&rsquo;t included.</p>
        </>
      )}
    </section>
  );
}
