import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { isModelDown, isRateLimit } from "@/lib/ai/provider";
import { translate } from "@/lib/ai/providers/anthropic";

const apiError = (status: number, message: string) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message } }, undefined, new Headers());

// A dead key or an empty budget must read as "service unavailable, use a sample",
// never as a generic 500 that looks like a bug in the user's document.
describe("anthropic error translation", () => {
  it("treats an exhausted budget as the model being down", () => {
    expect(isModelDown(translate(apiError(400, "Your credit balance is too low to access the Anthropic API.")))).toBe(true);
  });

  it("treats a revoked or expired key as the model being down", () => {
    expect(isModelDown(translate(apiError(401, "invalid x-api-key")))).toBe(true);
    expect(isModelDown(translate(apiError(403, "permission denied")))).toBe(true);
  });

  it("keeps rate limits apart", () => {
    expect(isRateLimit(translate(apiError(429, "rate limited")))).toBe(true);
  });

  it("leaves an ordinary bad request alone", () => {
    expect(isModelDown(translate(apiError(400, "messages: field required")))).toBe(false);
  });
});
