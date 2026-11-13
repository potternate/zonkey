import { cn } from "@/lib/utils";
import type { GameMode } from "@/lib/game/types";
import { SoundToggle } from "./sound-toggle";

export function GameHeader({ round, maxRounds, label, summary, roundLabel }: { round: number; maxRounds: number; label: string; summary?: string; roundLabel?: string }) {
  return (
    <header className="space-y-2 pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-primary">{label}</span>
        <span className="flex items-center gap-2 text-xs font-semibold">{roundLabel ?? <>Round {round}<span className="-ml-1.5 text-muted-foreground"> / {maxRounds}</span></>}<SoundToggle /></span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: maxRounds }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-8 transition-colors",
                i < round - 1 ? "bg-primary/50" : i === round - 1 ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
        {summary && <span className="text-xs text-muted-foreground tabular-nums">{summary}</span>}
      </div>
    </header>
  );
}

export function gameLabel(mode: GameMode, puzzleNumber: number | null): string {
  if (mode === "daily" && puzzleNumber !== null) return `DAILY #${puzzleNumber}`;
  if (mode === "practice" && puzzleNumber !== null) return `ARCHIVE #${puzzleNumber}`;
  return "UNLIMITED";
}
