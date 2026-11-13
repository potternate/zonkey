import { normalizeAnswer } from "@/lib/game/normalize";
import type { AnswerJudge, AnswerReview, ReviewAnswerInput } from "./types";

const DEV_EQUIVALENTS = [
  ["water", "waters", "watr"],
  ["fire", "fires"],
  ["love", "loves"],
  ["time", "times"],
  ["boat", "boats", "ship", "ships"],
  ["car", "cars", "automobile"],
  ["bicycle", "bicycles", "bike", "bikes"],
  ["sofa", "sofas", "couch", "couches"],
] as const;

function canonical(word: string): string {
  const normalized = normalizeAnswer(word);
  return DEV_EQUIVALENTS.find((group) => group.some((variant) => variant === normalized))?.[0] ?? normalized;
}

export class MockAnswerJudge implements AnswerJudge {
  async reviewAnswer(input: ReviewAnswerInput): Promise<AnswerReview> {
    const corrected = canonical(input.answer);
    const boardWord = input.roundNumber === 1
      ? input.boardWords.find((word) => canonical(word) === corrected) ?? null
      : null;
    const semanticMatch = input.roundNumber > 1 && corrected === canonical(input.aiAnswer);
    let hash = 0;
    for (const char of `${corrected}:${canonical(input.aiAnswer)}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return {
      word: boardWord ?? corrected,
      boardWord,
      semanticMatch,
      ...(input.roundNumber > 1 ? { closeness: semanticMatch ? 100 : 5 + (hash % 85) } : {}),
    };
  }
}
