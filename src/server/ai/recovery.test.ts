import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiPlayer } from "./openai-player";
import { OpenAiAnswerJudge } from "./openai-judge";
import { AI_ATTEMPT_TIMEOUT_MS } from "./completion";

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("openai", () => ({
  default: class { chat = { completions: { create: complete } }; },
}));
afterEach(() => { vi.useRealTimers(); complete.mockReset(); });

const choice = { choices: [{ message: { content: JSON.stringify({ word: "music" }) } }] };
const player = new OpenAiPlayer({ apiKey: "test", model: "primary", fallbackModel: "fallback" });

describe("AI recovery", () => {
  it("aborts a stalled primary and uses a validated independent fallback before accepting the guess", async () => {
    vi.useFakeTimers();
    const late = Promise.withResolvers<typeof choice>();
    complete.mockReturnValueOnce(late.promise).mockResolvedValueOnce(choice);
    const result = player.chooseWord({ wordA: "zebra", wordB: "piano" });
    await vi.advanceTimersByTimeAsync(AI_ATTEMPT_TIMEOUT_MS);
    expect(await result).toBe("music");
    expect(complete.mock.calls[0][1].signal.aborted).toBe(true);
    expect(complete.mock.calls.map(([input]) => input.model)).toEqual(["primary", "fallback"]);
    expect(complete.mock.calls[1][0].messages[1].content).not.toContain("player");
    late.resolve({ choices: [{ message: { content: '{"word":"stripes"}' } }] });
    expect(await result).toBe("music");
  });

  it("recovers from provider errors and rejects invalid fallback endpoints", async () => {
    complete.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(choice);
    expect(await player.chooseWord({ wordA: "zebra", wordB: "piano" })).toBe("music");
    complete.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      choices: [{ message: { content: '{"word":"piano"}' } }],
    });
    await expect(player.chooseWord({ wordA: "zebra", wordB: "piano" })).rejects.toMatchObject({ name: "AiUnavailableError" });
  });

  it("retries judging with the same model and keeps semantic and board validation", async () => {
    const judge = new OpenAiAnswerJudge({ apiKey: "test", model: "judge" });
    complete.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      choices: [{ message: { content: '{"word":"music","boardWord":null,"semanticMatch":false}' } }],
    });
    expect(await judge.reviewAnswer({
      answer: "music", wordA: "zebra", wordB: "piano", aiAnswer: "stripes", roundNumber: 1, boardWords: [],
    })).toMatchObject({ word: "music", semanticMatch: false });
    expect(complete.mock.calls.map(([input]) => input.model)).toEqual(["judge", "judge"]);
    expect(JSON.parse(complete.mock.calls[1][0].messages[1].content).aiAnswer).toBeNull();
  });
});
