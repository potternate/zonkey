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

function response(word: string, boardWord: string | null, semanticMatch = false) {
  return { choices: [{ message: { content: JSON.stringify({ word, boardWord, semanticMatch }) } }] };
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
    complete.mockResolvedValue(response("boat", null, true));
    expect(await judge.reviewAnswer({ ...input, roundNumber: 2, aiAnswer: "ship", boardWords: [] })).toMatchObject({ semanticMatch: true });
    expect(JSON.parse(complete.mock.calls[0][0].messages[1].content).aiAnswer).toBe("ship");
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
