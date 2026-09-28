/**
 * The HTTP surface: `/healthz` and the MCP endpoint. Auth (T010) wraps `/mcp` and adds the
 * protected-resource metadata route; the transport and session handling live in `sessions.ts`.
 */
import { Hono } from "hono";
import { ALL_RULES } from "@/lib/rules/load";
import { handleMcpRequest, sessionCount } from "./sessions";

export const PROTOCOL_VERSION = "2025-11-25";
export const MCP_PATH = process.env.MCP_PATH ?? "/mcp";

export function createApp() {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      protocol: PROTOCOL_VERSION,
      // Proves the shared engine loaded: the rules dataset is imported through the `@/` alias
      // from ../lib, under the react-server condition that neutralises `server-only`.
      rules: ALL_RULES.length,
      sessions: sessionCount(),
    }),
  );

  // POST initialises and carries requests, GET opens the notification stream, DELETE ends the
  // session — one handler, as the Streamable HTTP transport expects.
  app.all(MCP_PATH, (c) => handleMcpRequest(c.req.raw));

  return app;
}
