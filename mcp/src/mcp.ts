/**
 * The MCP server itself: identity, instructions, and the registration points that the later
 * tasks fill in. One instance per session (see `sessions.ts`), so nothing here may hold state
 * that belongs to a case.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const SERVER_INFO = {
  name: "overturn",
  title: "Overturn — health insurance appeal assistant",
  version: "0.1.0",
} as const;

/**
 * Read by an orchestrator (Alexa+, Claude, Inspector) before it calls anything. It states the
 * three rules the server enforces in code anyway, so a model that reads it fails less often.
 */
export const INSTRUCTIONS = [
  "Overturn helps a person in the United States appeal a denied health insurance claim or an",
  "erroneous medical bill. It is built for voice: ask one short question at a time, speak the",
  "`speak` field of every tool result back to the person verbatim, and never invent a deadline,",
  "a dollar amount, or a right — every one of them comes from a tool result with its source.",
  "",
  "Three rules the server enforces, so do not work around them:",
  "1. A tool that returns `needs_confirmation` has done nothing yet. Ask its `question`, wait for",
  "   the person's answer, and only then call the tool again with `confirm: true`.",
  "2. The letter is never dictated and never read out in full. It leaves by a written channel.",
  "3. This is legal information, not legal advice. Say so when you say what the deadline is.",
].join("\n");

/**
 * Builds a fresh server for one MCP session.
 *
 * Tools (T011–T013), resources and the voice persona prompt (T014) register here. Until then the
 * server answers `initialize` and nothing else, which is enough to negotiate the protocol version.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  return server;
}
