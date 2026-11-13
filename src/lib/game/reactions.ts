export type HeatBand = "freezing" | "cold" | "warm" | "hot" | "fire";

export const HEAT_LABELS: Record<HeatBand, string> = {
  freezing: "Freezing",
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
  fire: "On fire",
};

export function heatBand(closeness: number): HeatBand {
  if (closeness >= 75) return "fire";
  if (closeness >= 55) return "hot";
  if (closeness >= 35) return "warm";
  if (closeness >= 15) return "cold";
  return "freezing";
}

const LINES = {
  match: ["SAME BRAIN!", "Hee-haw! Mind meld.", "We're basically twins.", "Zebra-donkey telepathy."],
  synonym: ["Different word, same idea. I'll allow it!", "Close enough. Great minds!"],
  opening: ["Bold start. Now meet me in the middle.", "Interesting pick. Let's connect these.", "Now we've got a real pair."],
  roundOver: ["Out of guesses. Next round is ours.", "That one got away. Shake it off."],
  fire: ["SO close. I can feel it.", "Ahh, one step away!"],
  hot: ["Ooh, getting warmer!", "You're circling it."],
  warm: ["Same neighborhood, wrong house.", "Not bad. Think a little closer."],
  cold: ["Hmm, I went another way.", "Brr. Try a fresh angle."],
  freezing: ["We're on different planets.", "Did we even play the same game?"],
} as const;

export interface ReactionInput {
  matched: boolean;
  synonym: boolean;
  opening: boolean;
  roundOver: boolean;
  closeness?: number;
}

function pick(lines: readonly string[], seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return lines[hash % lines.length];
}

export function zonkeyLine(input: ReactionInput, seed: string): string {
  if (input.matched) return pick(input.synonym ? LINES.synonym : LINES.match, seed);
  if (input.roundOver) return pick(LINES.roundOver, seed);
  if (input.opening || input.closeness === undefined) return pick(LINES.opening, seed);
  return pick(LINES[heatBand(input.closeness)], seed);
}
