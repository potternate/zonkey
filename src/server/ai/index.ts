import "server-only";
import { MockAiPlayer } from "./mock-player";
import { OpenAiPlayer } from "./openai-player";
import { OpenAiAnswerJudge } from "./openai-judge";
import { MockAnswerJudge } from "./mock-judge";
import type { AiPlayer, AnswerJudge } from "./types";

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TEMPERATURE = 0.2;

function parseTemperature(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return DEFAULT_TEMPERATURE;
  if (value === "none") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : DEFAULT_TEMPERATURE;
}

let cached: AiPlayer | undefined;
let cachedJudge: AnswerJudge | undefined;

export function getAiPlayer(): AiPlayer {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    cached = new OpenAiPlayer({
      apiKey,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      temperature: parseTemperature(process.env.OPENAI_TEMPERATURE),
    });
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[zonkey] OPENAI_API_KEY not set; using mock AI player.");
    cached = new MockAiPlayer();
  } else {
    throw new Error("OPENAI_API_KEY must be set in production");
  }
  return cached;
}

export function getAnswerJudge(): AnswerJudge {
  if (cachedJudge) return cachedJudge;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    cachedJudge = new OpenAiAnswerJudge({
      apiKey,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      temperature: parseTemperature(process.env.OPENAI_TEMPERATURE),
    });
  } else if (process.env.NODE_ENV !== "production") {
    cachedJudge = new MockAnswerJudge();
  } else {
    throw new Error("OPENAI_API_KEY must be set in production");
  }
  return cachedJudge;
}

export { AiUnavailableError } from "./types";
