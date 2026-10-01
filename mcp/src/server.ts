/**
 * The HTTP surface: `/healthz`, the guarded MCP endpoint, the RFC 9728 metadata a client
 * discovers from a 401, and — only when the clock is pinned for the conformance test — a route to
 * move that clock. The transport and session handling live in `sessions.ts`.
 *
 * Every request to the MCP endpoint passes three gates, in this order:
 *   1. Origin   — a browser page on another site is refused before anything else (DNS rebinding).
 *   2. Size     — a body over the limit is refused before it is parsed.
 *   3. Bearer   — no valid token, no session.
 */
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ALL_RULES } from "@/lib/rules/load";
import { handleMcpRequest, onSessionEnd, sessionCount } from "./sessions";
import { store } from "./cases";
import { IS_TEST_CLOCK, advanceMinutes, clock } from "./clock";
import { createVerifier, loadAuthConfig, protectedResourceMetadata, unauthorizedHeaders } from "./auth";
import { createLogger } from "./log";

export const PROTOCOL_VERSION = "2025-11-25";
export const MCP_PATH = process.env.MCP_PATH ?? "/mcp";

export const log = createLogger(undefined, { service: "mcp" }, clock);

// When an MCP session ends — DELETE, dropped connection, idle sweep, or shutdown — its cases go
// with it. Registered once at module load, before any session can exist.
onSessionEnd((sessionId) => {
  const n = store.endSession(sessionId);
  if (n > 0) log.info("session_cases_discarded", { session: sessionId, cases: n });
});

const rpcError = (status: number, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * MCP 2025-11-25, Streamable HTTP transport: servers MUST validate the Origin header, and answer
 * 403 when it is present and not allowed. That is what stops a page on another site, reached
 * through DNS rebinding, from talking to a server it should never see.
 *
 * No Origin at all is allowed: it means a non-browser client — the simulator's server-side MCP
 * client, Alexa+, curl — and those are exactly the clients this endpoint exists for. The bearer
 * is still required of them.
 */
export function originGuard(allowed: ReadonlySet<string>): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("origin");
    if (origin !== undefined && !allowed.has(origin)) {
      log.info("origin_refused", { origin });
      return rpcError(403, -32000, "Origin not allowed.");
    }
    await next();
  };
}

/** The server's own public origin, plus whatever MCP_ALLOWED_ORIGINS adds (the Inspector, locally). */
export function allowedOrigins(env: Record<string, string | undefined>): Set<string> {
  const set = new Set<string>();
  const own = env.MCP_PUBLIC_URL ?? "http://localhost:8000";
  try {
    set.add(new URL(own).origin);
  } catch {
    // An unparseable public URL fails at auth config load; nothing to add here.
  }
  for (const o of (env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    set.add(o.replace(/\/$/, ""));
  }
  return set;
}

/** Large enough for a several-page PDF in base64, small enough that memory has a bound. */
export const MAX_BODY_BYTES = Number(process.env.MCP_MAX_BODY_BYTES ?? 10 * 1024 * 1024);

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
      // Counts only. A code or a fact here would leak from a public endpoint — and so would the
      // auth mode, which would tell a scanner when the server runs on a fixed dev password.
      sessions: sessionCount(),
      cases: store.stats(),
    }),
  );

  // Unauthenticated on purpose (RFC 9728): it is what a client reads after the 401 to find out
  // where to run the PKCE flow. It names the authorization server and nothing about anyone.
  app.get("/.well-known/oauth-protected-resource", (c) => c.json(protectedResourceMetadata(auth)));

  app.use(MCP_PATH, originGuard(allowedOrigins(process.env)));
  app.use(
    MCP_PATH,
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => rpcError(413, -32000, `Request body over ${MAX_BODY_BYTES} bytes.`),
    }),
  );

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
