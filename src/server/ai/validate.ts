import { validateAnswer } from "@/lib/game/normalize";

export type AiWordCheck = { ok: true; word: string } | { ok: false; reason: string };

export function checkAiWord(raw: unknown, wordA: string, wordB: string): AiWordCheck {
  if (typeof raw !== "string") return { ok: false, reason: "word must be a string" };
  const result = validateAnswer(raw, [wordA, wordB]);
  if (result.ok) return { ok: true, word: result.word };
  if (result.word.includes(" ")) return { ok: false, reason: "it must be exactly one word" };
  if (result.word === wordA || result.word === wordB) return { ok: false, reason: "it is one of the endpoints" };
  return { ok: false, reason: result.error.toLowerCase() };
}
