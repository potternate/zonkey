"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowLeft, ChartNoAxesColumn, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BrandHeader({
  onHome, onScores, home, disabled,
}: {
  onHome: () => void;
  onScores: () => void;
  home: boolean;
  disabled: boolean;
}) {
  const instructions = useRef<HTMLDialogElement>(null);

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b py-5 sm:py-6">
        <button onClick={onHome} disabled={disabled} aria-label="Zonkey home" className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">
          <span className="flex size-10 items-center justify-center rounded-xl bg-foreground">
            <Image src="/zonkey-mark.webp" alt="" width={29} height={34} priority className="h-8 w-7 object-contain" />
          </span>
          <span className="text-2xl font-extrabold tracking-[-0.07em]">zonkey<span className="text-muted-foreground">.</span></span>
        </button>
        <nav aria-label="Game navigation" className="flex gap-1">
          {!home && (
            <Button variant="ghost" onClick={onHome} disabled={disabled} className="hidden h-11 px-3 sm:inline-flex" aria-label="Back to home">
              <ArrowLeft className="size-4" /><span className="hidden sm:inline">Home</span>
            </Button>
          )}
          <Button variant="ghost" onClick={() => instructions.current?.showModal()} className="h-11 px-3" aria-label="How to play">
            <CircleHelp className="size-4" /><span className="hidden sm:inline">How to play</span>
          </Button>
          <Button variant="ghost" onClick={onScores} disabled={disabled} className="h-11 px-3" aria-label="Your scores">
            <ChartNoAxesColumn className="size-4" /><span className="hidden sm:inline">Your scores</span>
          </Button>
        </nav>
      </header>
      <dialog ref={instructions} aria-labelledby="instructions-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border bg-background p-7 text-foreground shadow-2xl backdrop:bg-black/40">
        <div className="flex items-center justify-between gap-4">
          <h2 id="instructions-title" className="text-2xl font-bold tracking-tight">A meeting of minds.</h2>
          <Button variant="ghost" size="icon" className="size-11" onClick={() => instructions.current?.close()} aria-label="Close instructions"><X /></Button>
        </div>
        <ol className="mt-5 space-y-5 text-sm leading-relaxed">
          <li><span className="eyebrow mb-1 block">01 · Make a connection</span>Two words. You and the AI each choose one word that connects them. The AI locks in its answer before you submit.</li>
          <li><span className="eyebrow mb-1 block">02 · Get on the same wavelength</span>Different answers become your next two words. Match to win in eight rounds or fewer. From round two, the same meaning counts.</li>
          <li><span className="eyebrow mb-1 block">03 · Come back for more</span>Daily gives everyone the same starting words. Unlimited gives you a fresh pair whenever you want.</li>
        </ol>
        <Button className="mt-7 h-12 w-full rounded-xl" onClick={() => instructions.current?.close()}>Got it. Let&rsquo;s connect.</Button>
      </dialog>
    </>
  );
}
