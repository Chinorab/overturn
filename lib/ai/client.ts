import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only. The API key never reaches the browser; every model call goes through a
 * route handler. Model and effort are env-tunable so cost can be dialled without a deploy.
 */
export const MODEL = process.env.OVERTURN_MODEL ?? "claude-opus-5";

type Effort = "low" | "medium" | "high";
const effortFrom = (v: string | undefined, fallback: Effort): Effort =>
  v === "low" || v === "medium" || v === "high" ? v : fallback;

export const EXTRACT_EFFORT = effortFrom(process.env.OVERTURN_EXTRACT_EFFORT, "medium");
export const WRITE_EFFORT = effortFrom(process.env.OVERTURN_WRITE_EFFORT, "medium");

/** Live uploads can be switched off (samples keep working) if credits run out mid-judging. */
export const LIVE_UPLOADS_ENABLED = process.env.OVERTURN_LIVE_UPLOADS !== "false";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new ModelUnavailableError("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ maxRetries: 1, timeout: 90_000 });
  return client;
}

export class ModelUnavailableError extends Error {
  code = "model_unavailable" as const;
}

export function isRateLimit(err: unknown): boolean {
  return err instanceof Anthropic.RateLimitError;
}

export function isModelDown(err: unknown): boolean {
  return (
    err instanceof ModelUnavailableError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.AuthenticationError
  );
}
