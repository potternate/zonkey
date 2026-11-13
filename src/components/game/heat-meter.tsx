import { HEAT_LABELS, heatBand } from "@/lib/game/reactions";
import { cn } from "@/lib/utils";

const SEGMENT_COLORS = ["#4de3ff", "#4de3ff", "#7fb8ff", "#a98cff", "#d77cff", "#ffb648", "#ff9a3d", "#ff7a3d", "#ff5a4a", "#ff3d6e"];

export function HeatMeter({ closeness, className }: { closeness: number; className?: string }) {
  const band = heatBand(closeness);
  const filled = Math.max(1, Math.min(10, Math.round(closeness / 10)));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={closeness}
      aria-label={`How close: ${HEAT_LABELS[band]}`}
      className={cn("border-2 bg-card px-4 py-3", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="eyebrow text-muted-foreground">How close</span>
        <span className="glow font-pixel text-xs uppercase" style={{ color: SEGMENT_COLORS[filled - 1] }}>
          {band === "fire" ? "🔥 " : band === "freezing" ? "❄ " : ""}{HEAT_LABELS[band]}
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1" aria-hidden="true">
        {SEGMENT_COLORS.map((color, i) => (
          <span
            key={color + i}
            className={cn("h-4", i < filled ? "animate-pop" : "bg-border")}
            style={i < filled ? { background: color, animationDelay: `${i * 60}ms` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
