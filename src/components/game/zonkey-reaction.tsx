import { cn } from "@/lib/utils";
import { PixelZebra } from "./pixel-scene";

export function ZonkeyReaction({ line, className }: { line: string; className?: string }) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <PixelZebra className="animate-bob w-16 shrink-0" />
      <p className="relative mb-4 flex-1 border-2 bg-card px-3 py-2 text-base leading-snug before:absolute before:bottom-2 before:-left-[10px] before:size-2 before:bg-border before:content-['']">
        {line}
      </p>
    </div>
  );
}
