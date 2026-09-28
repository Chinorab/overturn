import "server-only";
import type { ZodType } from "zod";

/**
 * The seam between Overturn's reasoning steps and whichever model runs them.
 *
 * Two shapes are enough for everything the product does:
 *  - `structured` — one call, schema in, parsed object out. Extraction, explanation, letter.
 *  - `chatWithTools` — the simulator's agentic loop over the MCP tools.
 *
 * Everything the app trusts is validated after the call by the schemas in `lib/schemas/`, so a
 * weaker model changes quality, never safety: the rules engine and the guard sit downstream of
 * this file and do not know which provider answered.
 */

export type Effort = "low" | "medium" | "high";

/** Which step is asking. Providers map this to a model and an effort level. */
export type Task = "extract" | "write";

export type DocumentInput =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; media_type: "image/jpeg" | "image/png"; base64: string };

export type Usage = { input: number; output: number };

export type StructuredRequest<T> = {
  task: Task;
  system: string;
  user: string;
  /** The model-facing schema. Providers compile it to their own structured-output format. */
  schema: ZodType<T>;
  /** Stable name for the schema; providers that need a named JSON schema use it. */
  schemaName: string;
  maxTokens: number;
  /** Only the extraction step sends one. A provider that cannot read it throws below. */
  document?: DocumentInput;
};

export type StructuredResult<T> = { value: T | null; usage: Usage };

export type ToolDef = {
  name: string;
  description: string;
  /** JSON Schema for the arguments, as `tools/list` returns it over MCP. */
  inputSchema: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string; isError?: boolean };

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  maxTokens: number;
};

export type ChatResult = { text: string; toolCalls: ToolCall[]; usage: Usage };

export interface LLMProvider {
  readonly id: string;
  /** For the `meta.model` field the API routes return, and for the logs. */
  modelFor(task: Task): string;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  chatWithTools(req: ChatRequest): Promise<ChatResult>;
}

/* -------------------------------------------------------------------------- errors */

/**
 * Provider-neutral failures. Each provider translates its own SDK's errors into these, so the
 * route handlers say the same thing to the person whichever model is configured.
 */
export class ModelUnavailableError extends Error {
  code = "model_unavailable" as const;
}

export class RateLimitedError extends Error {
  code = "rate_limited" as const;
}

/** The provider cannot read this input at all — an image on a text-only model, say. */
export class UnsupportedInputError extends Error {
  code = "unsupported_on_provider" as const;
}

export function isRateLimit(err: unknown): boolean {
  return err instanceof RateLimitedError;
}

export function isModelDown(err: unknown): boolean {
  return err instanceof ModelUnavailableError;
}

/* -------------------------------------------------------------------------- config */

export const effortFrom = (v: string | undefined, fallback: Effort): Effort =>
  v === "low" || v === "medium" || v === "high" ? v : fallback;

export const EXTRACT_EFFORT = effortFrom(process.env.OVERTURN_EXTRACT_EFFORT, "medium");
export const WRITE_EFFORT = effortFrom(process.env.OVERTURN_WRITE_EFFORT, "medium");

/** Live uploads can be switched off (samples keep working) if credits run out mid-judging. */
export const LIVE_UPLOADS_ENABLED = process.env.OVERTURN_LIVE_UPLOADS !== "false";

export type ProviderId = "anthropic" | "nebius" | "fake";

const PROVIDERS: ProviderId[] = ["anthropic", "nebius", "fake"];

function providerId(): ProviderId {
  const raw = process.env.OVERTURN_LLM_PROVIDER;
  if (!raw) return "anthropic";
  if ((PROVIDERS as string[]).includes(raw)) return raw as ProviderId;
  throw new ModelUnavailableError(
    `OVERTURN_LLM_PROVIDER="${raw}" is not one of ${PROVIDERS.join(", ")}`,
  );
}

const cache = new Map<ProviderId, LLMProvider>();

/**
 * The active provider, built once per id. Read at call time rather than at import time so a test
 * or a route can switch `OVERTURN_LLM_PROVIDER` without reloading the module graph.
 *
 * The imports are dynamic on purpose: a test running on the fake never loads the Anthropic SDK,
 * and the Nebius provider (T033) stays off the default path entirely.
 */
export async function getProvider(): Promise<LLMProvider> {
  const id = providerId();
  const hit = cache.get(id);
  if (hit) return hit;

  let built: LLMProvider;
  switch (id) {
    case "anthropic":
      built = new (await import("./providers/anthropic")).AnthropicProvider();
      break;
    case "fake":
      built = new (await import("./providers/fake")).FakeProvider();
      break;
    case "nebius":
      throw new ModelUnavailableError(
        'OVERTURN_LLM_PROVIDER="nebius" is declared but not implemented yet (T033).',
      );
  }
  cache.set(id, built);
  return built;
}

/** Tests only: forget the built providers so the next `getProvider()` re-reads the env. */
export function resetProviderCache(): void {
  cache.clear();
}
