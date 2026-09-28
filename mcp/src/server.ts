/**
 * The HTTP surface. T002 lands `/healthz` and the shared engine import; the MCP endpoint itself
 * arrives in T003 with the Streamable HTTP transport.
 */
import { Hono } from "hono";
import { ALL_RULES } from "@/lib/rules/load";

export const PROTOCOL_VERSION = "2025-11-25";

export function createApp() {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      protocol: PROTOCOL_VERSION,
      // Proves the shared engine loaded: the rules dataset is imported through the `@/` alias
      // from ../lib, under the react-server condition that neutralises `server-only`.
      rules: ALL_RULES.length,
    }),
  );

  return app;
}
