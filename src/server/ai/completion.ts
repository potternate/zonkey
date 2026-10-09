import type OpenAI from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export const AI_ATTEMPT_TIMEOUT_MS = 6_000;

export async function boundedCompletion(client: OpenAI, input: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("AI response timed out"));
    }, AI_ATTEMPT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      client.chat.completions.create(input, { signal: controller.signal, timeout: AI_ATTEMPT_TIMEOUT_MS, maxRetries: 0 }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
