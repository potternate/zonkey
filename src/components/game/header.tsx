import { cn } from "@/lib/utils";
import type { GameMode } from "@/lib/game/types";

export function GameHeader({ round, maxRounds, label }: { round: number; maxRounds: number; label: string }) {
  return (
    <header className="flex flex-col items-center gap-4 pt-9">
      <div className="eyebrow rounded-full border px-4 py-2 text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">
        Round {round}
        <span className="text-muted-foreground"> / {maxRounds}</span>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: maxRounds }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-colors",
              i < round - 1 ? "bg-foreground/60" : i === round - 1 ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>
    </header>
  );
}

export function gameLabel(mode: GameMode, puzzleNumber: number | null): string {
  return mode === "daily" && puzzleNumber !== null ? `DAILY #${puzzleNumber}` : "UNLIMITED";
}
