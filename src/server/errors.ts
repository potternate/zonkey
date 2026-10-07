export type GameErrorCode =
  | "auth_required"
  | "plus_required"
  | "not_configured"
  | "bad_request"
  | "invalid_answer"
  | "not_found"
  | "conflict"
  | "ai_unavailable"
  | "rate_limited"
  | "internal";

const STATUS: Record<GameErrorCode, number> = {
  auth_required: 401,
  plus_required: 402,
  not_configured: 503,
  bad_request: 400,
  invalid_answer: 422,
  not_found: 404,
  conflict: 409,
  ai_unavailable: 503,
  rate_limited: 429,
  internal: 500,
};

export class GameError extends Error {
  readonly status: number;

  constructor(
    readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
