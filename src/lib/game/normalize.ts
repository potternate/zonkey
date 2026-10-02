import { MAX_WORD_LENGTH } from "./config";

export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-+/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type AnswerValidation =
  | { ok: true; word: string }
  | { ok: false; word: string; error: string };

export function validateAnswer(
  raw: string,
  endpoints: readonly [string, string],
): AnswerValidation {
  const word = normalizeAnswer(raw);
  if (!word) return { ok: false, word, error: "Enter a word." };
  if (word.includes(" ")) return { ok: false, word, error: "One word only." };
  if (word.length > MAX_WORD_LENGTH) {
    return { ok: false, word, error: "That word is too long." };
  }
  if (endpoints.includes(word)) {
    return { ok: false, word, error: "Pick a new word, not one on the board." };
  }
  return { ok: true, word };
}
