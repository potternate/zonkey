"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixelZebra } from "./pixel-scene";

const DISMISS_KEY = "zonkey-install-dismissed";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

// Registered at import time: the browser fires this once, possibly mid-game before this component mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((notify) => notify());
  });
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function ios(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Nudges players to add Zonkey to their Home Screen: native prompt where supported, instructions on iOS. */
export function InstallPrompt() {
  const [mode, setMode] = useState<"ios" | "prompt" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    try {
      if (standalone() || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    if (ios()) setMode("ios");
    const onPrompt = () => { if (deferred) { setEvent(deferred); setMode("prompt"); } };
    onPrompt();
    listeners.add(onPrompt);
    return () => { listeners.delete(onPrompt); };
  }, []);

  function dismiss() {
    setMode(null);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function install() {
    if (!event) return;
    deferred = null;
    setEvent(null);
    setMode(null);
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") dismiss();
  }

  if (!mode) return null;
  return (
    <div className="relative mt-5 flex items-center gap-3 border-2 border-dashed bg-background/40 p-3 pr-10 text-left">
      <PixelZebra className="w-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-snug font-semibold">Play Zonkey like an app</p>
        {mode === "ios" ? (
          <p className="text-xs leading-snug text-muted-foreground">
            Tap <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> then <span className="text-foreground">Add to Home Screen</span>.
          </p>
        ) : (
          <Button size="sm" onClick={install} className="h-9 text-sm">Add to Home Screen</Button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute top-1 right-1 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
