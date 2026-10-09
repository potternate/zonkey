import { randomInt } from "node:crypto";
import { STARTING_PAIRS } from "@/lib/game/pairs";
import { THEMED_PAIRS, type UnlimitedTheme } from "@/lib/game/themes";

export function presetOpeningWords(count: number, theme?: UnlimitedTheme): string[] {
  const pairs = theme ? THEMED_PAIRS[theme] : STARTING_PAIRS;
  const words = [...new Set(pairs.flatMap((pair) => [pair.a, pair.b]))];
  if (count > words.length) throw new Error("Not enough opening words");
  return Array.from({ length: count }, () => words.splice(randomInt(words.length), 1)[0]);
}
