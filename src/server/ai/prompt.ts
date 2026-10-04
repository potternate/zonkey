export const DEFAULT_SYSTEM_PROMPT = `You are playing Zonkey, a word-convergence game.
Two words are provided as endpoints. Choose the single word that you believe a typical human player would be most likely to associate with BOTH endpoints.
The objective is not to find an objectively correct answer. The objective is to predict human word association.
Prefer common, intuitive, everyday associations over obscure or clever ones.
Choose exactly one word.
Do not choose either endpoint.
Return JSON only, in the form {"word": "example"}.`;

export function getSystemPrompt(): string {
  return process.env.ZONKEY_SYSTEM_PROMPT?.trim()
    || process.env.CONNECT_TWO_SYSTEM_PROMPT?.trim()
    || DEFAULT_SYSTEM_PROMPT;
}

export function buildUserPrompt(wordA: string, wordB: string): string {
  return `Endpoints: "${wordA}" and "${wordB}"`;
}

export function buildCorrectionPrompt(previous: string, reason: string): string {
  return `"${previous}" is not allowed: ${reason}. Choose a different single word.`;
}
