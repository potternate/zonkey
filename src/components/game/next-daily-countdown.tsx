"use client";

import { useEffect, useState } from "react";
import { formatCountdown, msUntilNextDaily } from "@/lib/game/countdown";
import { cn } from "@/lib/utils";

export function NextDailyCountdown({ className }: { className?: string }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilNextDaily());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (ms === null) return null;
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="eyebrow text-muted-foreground">{ms > 1000 ? "Next Daily in" : "New Daily is ready"}</span>
      <time className="glow font-pixel text-xl text-primary tabular-nums" dateTime={`PT${Math.ceil(ms / 1000)}S`} aria-live="off">
        {formatCountdown(ms)}
      </time>
    </div>
  );
}
