/**
 * The HTTP surface: `/healthz`, the auth-guarded MCP endpoint, the RFC 9728 metadata a client
 * discovers from a 401, and — only when the clock is pinned for the conformance test — a route to
 * move that clock. The transport and session handling live in `sessions.ts`.
 */
import { Hono } from "hono";
import { ALL_RULES } from "@/lib/rules/load";
import { handleMcpRequest, onSessionEnd, sessionCount } from "./sessions";
import { store } from "./cases";
import { IS_TEST_CLOCK, advanceMinutes, clock } from "./clock";
import { createVerifier, loadAuthConfig, protectedResourceMetadata, unauthorizedHeaders } from "./auth";
import { createLogger } from "./log";

export const PROTOCOL_VERSION = "2025-11-25";
export const MCP_PATH = process.env.MCP_PATH ?? "/mcp";

export const log = createLogger(undefined, { service: "mcp" }, clock);

// When an MCP session ends — DELETE, dropped connection, or shutdown — its cases go with it.
// Registered once at module load, before any session can exist.
onSessionEnd((sessionId) => {
  const n = store.endSession(sessionId);
  if (n > 0) log.info("session_cases_discarded", { session: sessionId, cases: n });
});

export function createApp() {
  const app = new Hono();
  // Throws at startup on a misconfiguration, rather than serving an open endpoint.
  const auth = loadAuthConfig(process.env);
  const verify = createVerifier(auth);

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      protocol: PROTOCOL_VERSION,
      // Proves the shared engine loaded: the rules dataset is imported through the `@/` alias
      // from ../lib, under the react-server condition that neutralises `server-only`.
      rules: ALL_RULES.length,
      authMode: auth.mode,
      sessions: sessionCount(),
      // Counts only. A code or a fact here would leak from a public endpoint.
      cases: store.stats(),
    }),
  );

  // Unauthenticated on purpose (RFC 9728): it is what a client reads after the 401 to find out
  // where to run the PKCE flow. It names the authorization server and nothing about anyone.
  app.get("/.well-known/oauth-protected-resource", (c) => c.json(protectedResourceMetadata(auth)));

  // POST initialises and carries requests, GET opens the notification stream, DELETE ends the
  // session — one handler, as the Streamable HTTP transport expects.
  app.all(MCP_PATH, async (c) => {
    const authorization = c.req.header("authorization") ?? null;
    const result = await verify(authorization, clock());
    if (!result.ok) {
      log.info("unauthorized", { reason: result.reason, method: c.req.method });
      return c.json({ error: "unauthorized", reason: result.reason }, 401, unauthorizedHeaders(auth, result.reason));
    }
    return handleMcpRequest(c.req.raw, { principal: result.principal, authorization: authorization! });
  });

  if (IS_TEST_CLOCK) {
    // Exists only because OVERTURN_CLOCK is set, which production never does. It lets the
    // conformance test watch a case expire without waiting thirty minutes.
    log.warn("test_clock_mounted", {});
    app.post("/__test/clock", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { advanceMinutes?: number };
      const now = advanceMinutes(Number(body.advanceMinutes ?? 0));
      store.sweep();
      return c.json({ now: new Date(now).toISOString(), cases: store.stats() });
    });
  }

  return app;
}
