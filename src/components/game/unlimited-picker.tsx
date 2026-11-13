"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bird, Mountain, Shuffle, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_LABELS, UNLIMITED_THEMES, type UnlimitedTheme } from "@/lib/game/themes";
import { survivalBest } from "./survival-game";

const ICONS = { animals: Bird, food: Utensils, outdoors: Mountain };

export function UnlimitedPicker({ onChoose, onSurvival, onHome, busy, error }: {
  onChoose: (theme: UnlimitedTheme | null) => void; onSurvival: () => void; onHome: () => void; busy: boolean; error: string | null;
}) {
  const [best, setBest] = useState(0);
  useEffect(() => setBest(survivalBest()), []);
  return (
    <section className="my-auto space-y-6 py-10">
      <div><h1 className="text-3xl font-bold tracking-tight">Unlimited</h1><p className="mt-2 text-sm text-muted-foreground">Pick a word safari.</p></div>
      <Button onClick={onSurvival} disabled={busy} className="h-auto min-h-16 w-full justify-between gap-3 px-5 py-3 text-left">
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-3"><span aria-hidden="true" className="text-success">♥♥♥</span>Survival</span>
          <span className="text-xs font-normal normal-case opacity-80">Endless rounds · 3 lives{best ? ` · Best ${best.toLocaleString("en-US")}` : ""}</span>
        </span><ArrowRight className="size-4 shrink-0" />
      </Button>
      <Button variant="outline" onClick={() => onChoose(null)} disabled={busy} className="h-14 w-full justify-between rounded-xl px-5">
        <span className="flex items-center gap-3"><Shuffle className="size-4" />Random · full pool</span><ArrowRight className="size-4" />
      </Button>
      <div className="grid gap-3">
        {UNLIMITED_THEMES.map((theme) => {
          const Icon = ICONS[theme];
          return <Button key={theme} variant="outline" onClick={() => onChoose(theme)} disabled={busy} className="h-14 justify-between rounded-xl px-5">
            <span className="flex items-center gap-3"><Icon className="size-4" />{THEME_LABELS[theme]}</span><ArrowRight className="size-4" />
          </Button>;
        })}
      </div>
      {busy && <p role="status" className="text-center text-sm text-muted-foreground">Getting ready…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button variant="ghost" onClick={onHome} disabled={busy}><ArrowLeft className="size-4" />Back</Button>
    </section>
  );
}
