import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  EXTRACT_EFFORT,
  ModelUnavailableError,
  RateLimitedError,
  WRITE_EFFORT,
  type ChatRequest,
  type ChatResult,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
  type Task,
  type ToolCall,
} from "../provider";

/** Model and effort are env-tunable so cost can be dialled without a deploy. */
export const MODEL = process.env.OVERTURN_MODEL ?? "claude-opus-5";

/**
 * The default provider, and the one the Amazon demo runs on. The API key never reaches the
 * browser: every call goes through a route handler or the MCP server, both server-only.
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

  async chatWithTools(req: ChatRequest): Promise<ChatResult> {
    const client = this.sdk();

    // Anthropic carries tool results as `tool_result` blocks in a *user* message, so runs of
    // our `tool` messages collapse into one turn — which is also what the API requires.
    const messages: Anthropic.MessageParam[] = [];
    for (const m of req.messages) {
      if (m.role === "tool") {
        const block: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: m.toolCallId,
          content: m.content,
          ...(m.isError ? { is_error: true } : {}),
        };
        const last = messages.at(-1);
        if (last?.role === "user" && Array.isArray(last.content)) last.content.push(block);
        else messages.push({ role: "user", content: [block] });
        continue;
      }
      if (m.role === "user") {
        messages.push({ role: "user", content: [{ type: "text", text: m.text }] });
        continue;
      }
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const call of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      if (content.length) messages.push({ role: "assistant", content });
    }

    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: req.maxTokens,
        system: req.system,
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
        messages,
      });

      let text = "";
      const toolCalls: ToolCall[] = [];
      for (const block of res.content) {
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, arguments: (block.input ?? {}) as Record<string, unknown> });
        }
      }
      return { text, toolCalls, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
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
