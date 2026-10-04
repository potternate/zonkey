import type { GameView } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function Pill({ word, tone }: { word: string; tone: "start" | "miss" | "hit" }) {
  return (
    <span
      className={cn(
        "min-w-0 break-words rounded-xl px-3 py-3 text-center text-sm font-semibold",
        tone === "start" && "border border-primary/25 bg-primary/10 text-primary",
        tone === "miss" && "border bg-card",
        tone === "hit" && "border border-success-border bg-success-muted text-success",
      )}
    >
      {word}
    </span>
  );
}

export function Chain({ game }: { game: GameView }) {
  return (
    <ol className="flex w-full flex-col gap-2">
      <li className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2 text-[10px] font-bold tracking-[0.25em] text-muted-foreground">
        <span />
        <span className="text-center">YOU</span>
        <span className="text-center">ZONKEY AI</span>
      </li>
      <li className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
        <span className="text-xs text-muted-foreground">▶</span>
        <Pill word={game.startPair.a} tone="start" />
        <Pill word={game.startPair.b} tone="start" />
      </li>
      {game.rounds.map((r, i) => (
        <li
          key={r.number}
          className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both grid grid-cols-[2rem_1fr_1fr] items-center gap-2 duration-300"
          style={{ animationDelay: `${(i + 1) * 80}ms` }}
        >
          <span className="text-xs font-bold text-muted-foreground">{r.number}</span>
          <Pill word={r.playerAnswer} tone={r.matched ? "hit" : "miss"} />
          <Pill word={r.aiAnswer} tone={r.matched ? "hit" : "miss"} />
        </li>
      ))}
    </ol>
  );
}
