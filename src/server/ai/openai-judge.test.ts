import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAiAnswerJudge } from "./openai-judge";
import type { ReviewAnswerInput } from "./types";

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: complete } };
  },
}));

const input: ReviewAnswerInput = {
  answer: "ships", wordA: "pizza", wordB: "ocean", aiAnswer: "water", roundNumber: 1, boardWords: ["boat"],
};
const judge = new OpenAiAnswerJudge({ apiKey: "test-placeholder", model: "test-model" });

function response(word: string, boardWord: string | null, semanticMatch = false, closeness = 0) {
  return { choices: [{ message: { content: JSON.stringify({ word, boardWord, semanticMatch, closeness }) } }] };
}

beforeEach(() => complete.mockReset());

describe("OpenAI guess judge", () => {
  it("requests structured correction without giving first-round normalization the AI answer", async () => {
    complete.mockResolvedValue(response("boat", "boat"));
    expect(await judge.reviewAnswer(input)).toEqual({ word: "boat", boardWord: "boat", semanticMatch: false });
    const request = complete.mock.calls[0][0];
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(JSON.parse(request.messages[1].content).aiAnswer).toBeNull();
  });

  it("checks the committed AI answer for later-round semantic equivalence", async () => {
    complete.mockResolvedValue(response("boat", null, true, 95));
    expect(await judge.reviewAnswer({ ...input, roundNumber: 2, aiAnswer: "ship", boardWords: [] })).toMatchObject({ semanticMatch: true });
    expect(JSON.parse(complete.mock.calls[0][0].messages[1].content).aiAnswer).toBe("ship");
  });

  it("does not rewrite a different guess into the AI answer", async () => {
    complete.mockResolvedValue(response("ship", null, true, 100));
    expect(await judge.reviewAnswer({ ...input, answer: "pizza", wordA: "cheese", roundNumber: 2, aiAnswer: "ship", boardWords: [] }))
      .toMatchObject({ word: "pizza" });
    complete.mockResolvedValue(response("ship", null, false, 100));
    expect(await judge.reviewAnswer({ ...input, answer: "shpi", roundNumber: 2, aiAnswer: "ship", boardWords: [] }))
      .toMatchObject({ word: "ship" });
  });

  it("ignores a semantic match the judge itself rates as distant", async () => {
    complete.mockResolvedValue(response("pizza", null, true, 10));
    expect(await judge.reviewAnswer({ ...input, answer: "pizza", wordA: "cheese", roundNumber: 2, aiAnswer: "ship", boardWords: [] }))
      .toMatchObject({ semanticMatch: false });
  });

  it("returns a clamped closeness only for later rounds", async () => {
    complete.mockResolvedValue(response("boat", null, false, 140));
    expect(await judge.reviewAnswer({ ...input, roundNumber: 2, aiAnswer: "ship", boardWords: [] })).toMatchObject({ closeness: 100 });
    complete.mockResolvedValue(response("boat", "boat", false, 60));
    expect(await judge.reviewAnswer(input)).not.toHaveProperty("closeness");
  });

  it("rejects an invented board entry", async () => {
    complete.mockResolvedValue(response("boat", "vessel"));
    await expect(judge.reviewAnswer(input)).rejects.toMatchObject({ name: "AiUnavailableError" });
  });

  it("rejects endpoint words and phrases rather than accepting a bad correction", async () => {
    complete.mockResolvedValueOnce(response("ocean", null)).mockResolvedValueOnce(response("big boat", null));
    await expect(judge.reviewAnswer(input)).rejects.toMatchObject({ name: "AiUnavailableError" });
    await expect(judge.reviewAnswer(input)).rejects.toMatchObject({ name: "AiUnavailableError" });
  });
});
