import type { AiPlayer, ChooseWordInput } from "./types";

/**
 * Local development stand-in when OPENAI_API_KEY is unset. Picks
 * deterministically from a tiny vocabulary so games can actually be won.
 */
export const MOCK_VOCABULARY = ["water", "fire", "love", "time"] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function mockChoice(wordA: string, wordB: string): string {
  const options = MOCK_VOCABULARY.filter((w) => w !== wordA && w !== wordB);
  return options[hash(`${wordA}|${wordB}`) % options.length];
}

export class MockAiPlayer implements AiPlayer {
  readonly id = "mock";

  async chooseWord({ wordA, wordB }: ChooseWordInput): Promise<string> {
    return mockChoice(wordA, wordB);
  }
}
