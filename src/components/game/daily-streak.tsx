import { Flame } from "lucide-react";
import type { DailyStreak } from "@/lib/game/scores";

export function DailyStreakSummary({ streak }: { streak: DailyStreak }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <dl className="grid grid-cols-2 gap-4 text-center">
        <div>
          <dd className="flex items-center justify-center gap-2 text-2xl font-bold text-primary tabular-nums">
            <Flame className="size-5" aria-hidden="true" />{streak.current}
          </dd>
          <dt className="mt-1 text-xs text-muted-foreground">Daily streak</dt>
        </div>
        <div>
          <dd className="text-2xl font-bold tabular-nums">{streak.best}</dd>
          <dt className="mt-1 text-xs text-muted-foreground">Best streak</dt>
        </div>
      </dl>
      <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
        Finish all five Daily rounds before midnight UTC. Every completed score counts.
      </p>
    </div>
  );
}
