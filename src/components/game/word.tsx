import { cn } from "@/lib/utils";

function sizeFor(word: string): string {
  if (word.length <= 6) return "text-6xl";
  if (word.length <= 9) return "text-5xl";
  if (word.length <= 12) return "text-4xl";
  return "text-3xl";
}

export function BigWord({ word, className }: { word: string; className?: string }) {
  return (
    <span className={cn("block w-full min-w-0 font-heading font-bold lowercase leading-tight tracking-[-0.045em] break-words", sizeFor(word), className)}>
      {word}
    </span>
  );
}

export function WordPairCard({ wordA, wordB, className }: { wordA: string; wordB: string; className?: string }) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border bg-card px-4 py-5 text-center", className)}>
      <BigWord word={wordA} className="text-[clamp(1.35rem,5.5vw,2.25rem)]" />
      <span className="text-xl text-primary" aria-hidden="true">↔</span>
      <BigWord word={wordB} className="text-[clamp(1.35rem,5.5vw,2.25rem)]" />
    </div>
  );
}
