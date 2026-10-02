export interface ChooseWordInput {
  wordA: string;
  wordB: string;
}

/**
 * Anything that can play the AI side. Personalities, difficulty levels, or
 * other models plug in here (see getAiPlayer).
 */
export interface AiPlayer {
  readonly id: string;
  /** Returns a normalized single word that is not either endpoint. */
  chooseWord(input: ChooseWordInput): Promise<string>;
}

export interface ReviewAnswerInput {
  answer: string;
  wordA: string;
  wordB: string;
  aiAnswer: string;
  roundNumber: number;
  boardWords: string[];
}

export interface AnswerReview {
  word: string;
  boardWord: string | null;
  semanticMatch: boolean;
}

export interface AnswerJudge {
  reviewAnswer(input: ReviewAnswerInput): Promise<AnswerReview>;
}

export class AiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiUnavailableError";
  }
}
