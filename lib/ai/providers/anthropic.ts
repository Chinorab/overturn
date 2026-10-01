import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  EXTRACT_EFFORT,
  ModelUnavailableError,
  RateLimitedError,
  WRITE_EFFORT,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
  type Task,
} from "../provider";

/** Model and effort are env-tunable so cost can be dialled without a deploy. */
export const MODEL = process.env.OVERTURN_MODEL ?? "claude-opus-5";

/**
 * The default provider. The API key never reaches the browser: every call goes through a
 * server-only route handler.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  private client: Anthropic | null = null;

  modelFor(_task: Task): string {
    return MODEL;
  }

  private sdk(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new ModelUnavailableError("ANTHROPIC_API_KEY is not set");
    this.client ??= new Anthropic({ maxRetries: 1, timeout: 90_000 });
    return this.client;
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const client = this.sdk();
    const effort = req.task === "extract" ? EXTRACT_EFFORT : WRITE_EFFORT;

    const content: Anthropic.ContentBlockParam[] = [];
    if (req.document) {
      content.push(
        req.document.kind === "pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: req.document.base64 } }
          : { type: "image", source: { type: "base64", media_type: req.document.media_type, data: req.document.base64 } },
      );
    }
    content.push({ type: "text", text: req.user });

    try {
      const res = await client.messages.parse({
        model: MODEL,
        max_tokens: req.maxTokens,
        system: req.system,
        output_config: { effort, format: zodOutputFormat(req.schema) },
        messages: [{ role: "user", content }],
      });
      return {
        value: (res.parsed_output as T | null) ?? null,
        usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
      };
    } catch (err) {
      throw translate(err);
    }
  }
}

/** SDK errors become the provider-neutral ones the route handlers already know how to say. */
function translate(err: unknown): unknown {
  if (err instanceof Anthropic.RateLimitError) return new RateLimitedError(err.message);
  if (
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.AuthenticationError
  ) {
    return new ModelUnavailableError(err.message);
  }
  return err;
}
