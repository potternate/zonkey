"use client";

import { useEffect, useState } from "react";
import { BigWord } from "./word";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FRAME_MS = 60;
const SPIN_FRAMES = 6;

function scramble(word: string, locked: number): string {
  return [...word].map((char, i) => (i < locked ? char : LETTERS[Math.floor(Math.random() * LETTERS.length)])).join("");
}

/** Slot-machine reveal: letters spin, then lock left to right. */
export function ScrambleWord({ word, delay, className, onTick, onDone }: {
  word: string; delay: number; className?: string; onTick?: () => void; onDone?: () => void;
}) {
  const [shown, setShown] = useState(() => scramble(word, 0));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(word);
      onDone?.();
      return;
    }
    let frame = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        frame += 1;
        const locked = Math.max(0, frame - SPIN_FRAMES);
        setShown(scramble(word, locked));
        onTick?.();
        if (locked >= word.length) {
          clearInterval(interval);
          onDone?.();
        }
      }, FRAME_MS);
    }, delay);
    return () => { clearTimeout(start); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per word
  }, [word, delay]);

  return <><span className="sr-only">{word}</span><span aria-hidden="true"><BigWord word={shown} className={className} /></span></>;
}
