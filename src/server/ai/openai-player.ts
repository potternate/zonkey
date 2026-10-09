import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { buildCorrectionPrompt, buildUserPrompt, getSystemPrompt } from "./prompt";
import { AiUnavailableError, type AiPlayer, type ChooseWordInput } from "./types";
import { checkAiWord } from "./validate";
import { boundedCompletion } from "./completion";

const MAX_ATTEMPTS = 2;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "zonkey_answer",
    strict: true,
    schema: {
      type: "object",
      properties: { word: { type: "string" } },
      required: ["word"],
      additionalProperties: false,
    },
  },
} as const;

export interface OpenAiPlayerOptions {
  apiKey: string;
  model: string;
  /** Omit for models that don't accept a temperature. */
  temperature?: number;
  systemPrompt?: string;
  fallbackModel?: string;
}

export class OpenAiPlayer implements AiPlayer {
  readonly id: string;
  private client: OpenAI;

  constructor(private options: OpenAiPlayerOptions) {
    this.id = `openai:${options.model}`;
    this.client = new OpenAI({ apiKey: options.apiKey, maxRetries: 0 });
  }

  async chooseWord({ wordA, wordB }: ChooseWordInput): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: this.options.systemPrompt ?? getSystemPrompt() },
      { role: "user", content: buildUserPrompt(wordA, wordB) },
    ];
    let lastReason = "no response";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let content: string | null;
      try {
        const completion = await boundedCompletion(this.client, {
          model: attempt === 0 ? this.options.model : this.options.fallbackModel ?? this.options.model,
          messages,
          response_format: RESPONSE_FORMAT,
          ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
        });
        content = completion.choices[0]?.message?.content ?? null;
      } catch (err) {
        if (attempt < MAX_ATTEMPTS - 1) continue;
        throw new AiUnavailableError("OpenAI request failed", { cause: err });
      }
      if (!content) {
        lastReason = "empty response";
        continue;
      }
      let raw: unknown;
      try {
        raw = (JSON.parse(content) as { word?: unknown }).word;
      } catch {
        lastReason = "invalid JSON";
        continue;
      }
      const check = checkAiWord(raw, wordA, wordB);
      if (check.ok) return check.word;
      lastReason = check.reason;
      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: buildCorrectionPrompt(String(raw), check.reason) });
    }
    throw new AiUnavailableError(`OpenAI returned no valid word (${lastReason})`);
  }
}
