import type { FirstGuessBoard } from "@/lib/game/first-guesses";

export function FirstGuesses({ board, yourWord }: { board: FirstGuessBoard; yourWord: string }) {
  return (
    <section className="w-full space-y-3 rounded-2xl border bg-card p-5 text-left">
      <h3 className="eyebrow">The world&rsquo;s first thoughts</h3>
      <p className="text-xs text-muted-foreground">{board.attempts} accepted guesses for these starting words</p>
      <ul className="divide-y">
        {board.guesses.slice(0, 8).map((guess) => (
          <li key={guess.word} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className={`min-w-0 break-words ${guess.word === yourWord ? "font-bold" : ""}`}>
              {guess.word}{guess.word === yourWord && <span className="ml-2 text-xs text-muted-foreground">YOU</span>}
            </span>
            <span className="shrink-0 font-bold tabular-nums">{guess.count}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Equivalent first guesses share a count. Each new guess starts at 1.</p>
    </section>
  );
}
