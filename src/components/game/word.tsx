import { cn } from "@/lib/utils";

function sizeFor(word: string): string {
  if (word.length <= 6) return "text-6xl";
  if (word.length <= 9) return "text-5xl";
  if (word.length <= 12) return "text-4xl";
  return "text-3xl";
}

export function BigWord({ word, className }: { word: string; className?: string }) {
  return (
    <span className={cn("block w-full min-w-0 font-bold lowercase leading-tight tracking-[-0.055em] break-words", sizeFor(word), className)}>
      {word}
    </span>
  );
}
