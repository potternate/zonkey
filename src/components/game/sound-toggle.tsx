"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setSoundEnabled, soundEnabled } from "@/lib/client/sfx";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundEnabled()), []);
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={() => { setSoundEnabled(!on); setOn(!on); }}
      aria-pressed={on}
      aria-label={on ? "Turn sound and haptics off" : "Turn sound and haptics on"}
      className={cn("-my-2 flex size-10 items-center justify-center text-muted-foreground hover:text-foreground", className)}
    >
      <Icon className="size-5" />
    </button>
  );
}
