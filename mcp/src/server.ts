/**
 * The HTTP surface: `/healthz`, the MCP endpoint, and — only when the clock is pinned for the
 * conformance test — a route to move that clock. Auth (T010) wraps `/mcp` and adds the
 * protected-resource metadata route; the transport and session handling live in `sessions.ts`.
 */
import { Hono } from "hono";
import { ALL_RULES } from "@/lib/rules/load";
import { handleMcpRequest, onSessionEnd, sessionCount } from "./sessions";
import { store } from "./cases";
import { IS_TEST_CLOCK, advanceMinutes, clock } from "./clock";

export const PROTOCOL_VERSION = "2025-11-25";
export const MCP_PATH = process.env.MCP_PATH ?? "/mcp";

// When an MCP session ends — DELETE, dropped connection, or shutdown — its cases go with it.
// Registered once at module load, before any session can exist.
onSessionEnd((sessionId) => {
  store.endSession(sessionId);
});

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
      // Counts only. A code or a fact here would leak from a public endpoint.
      cases: store.stats(),
    }),
  );

  // POST initialises and carries requests, GET opens the notification stream, DELETE ends the
  // session — one handler, as the Streamable HTTP transport expects.
  app.all(MCP_PATH, (c) => handleMcpRequest(c.req.raw));

  if (IS_TEST_CLOCK) {
    // Exists only because OVERTURN_CLOCK is set, which production never does. It lets the
    // conformance test watch a case expire without waiting thirty minutes.
    console.error(JSON.stringify({ t: new Date(clock()).toISOString(), level: "warn", event: "test_clock_mounted" }));
    app.post("/__test/clock", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { advanceMinutes?: number };
      const now = advanceMinutes(Number(body.advanceMinutes ?? 0));
      store.sweep();
      return c.json({ now: new Date(now).toISOString(), cases: store.stats() });
    });
  }

  return app;
}
