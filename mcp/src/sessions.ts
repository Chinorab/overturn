/**
 * Session registry for the Streamable HTTP transport.
 *
 * Stateful mode: the server mints the `Mcp-Session-Id` on `initialize` and every later request
 * carries it. One transport and one `McpServer` per session, held in memory only — when the
 * session ends, or the process dies, the case ends with it (FR-040). Nothing is written to disk.
 */
import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./mcp";
import { fetchAccount, type Account, type AuthConfig, type Principal } from "./auth";

/** What the auth layer establishes about the caller, per request. */
export type Caller = { principal: Principal; authorization: string };

type Session = {
  id: string;
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
  /** The subject the session was opened for. A later request from another subject is refused. */
  subject: string;
  /** Most recent bearer for this session, so userinfo runs with a live token. */
  authorization: string;
  /** Fetched at most once per session, then held until the session ends. */
  account: Promise<Account> | null;
  startedAt: number;
};

const sessions = new Map<string, Session>();

/** Called when a session ends, for whatever reason. The case store subscribes here. */
type EndHook = (sessionId: string) => void;
const endHooks: EndHook[] = [];

export function onSessionEnd(hook: EndHook): void {
  endHooks.push(hook);
}

export function sessionCount(): number {
  return sessions.size;
}

/**
 * The linked account for a session — the only place the email exists, fetched once.
 * Tools use `emailMasked` / `emailMaskedSpoken`; the address itself is only ever a destination.
 */
export function sessionAccount(sessionId: string, cfg: AuthConfig): Promise<Account> {
  const session = sessions.get(sessionId);
  if (!session) return Promise.reject(new Error("unknown session"));
  session.account ??= fetchAccount(cfg, session.authorization);
  return session.account;
}

/** A JSON-RPC error carried by an HTTP status, for the cases the transport never sees. */
function rpcError(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function endSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  // Already gone: `onsessionclosed` and `onclose` both fire for a DELETE, and the delete below
  // is what makes the second call a no-op.
  if (!session) return;
  sessions.delete(sessionId);
  for (const hook of endHooks) {
    try {
      hook(sessionId);
    } catch {
      // A hook must never keep a session alive.
    }
  }
  try {
    await session.transport.close();
  } catch {
    // Closing an already-closed transport is not an error worth reporting.
  }
}

/** Shutdown path: every live session is closed before the process exits (FR-040). */
export async function closeAllSessions(): Promise<void> {
  await Promise.all([...sessions.keys()].map(endSession));
}

const authInfoOf = (caller: Caller): AuthInfo => ({
  token: caller.authorization.replace(/^Bearer\s+/i, ""),
  clientId: caller.principal.clientId,
  scopes: caller.principal.scope,
  expiresAt: Math.floor(caller.principal.expiresAt / 1000),
});

/**
 * Routes one HTTP request to its session's transport, creating the session on `initialize`.
 * The caller has already been authenticated: this decides which session they may touch.
 */
export async function handleMcpRequest(req: Request, caller: Caller): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      // Expired, or served by another instance. The client must start over — the person is told
      // in words by the tool layer, this is the machine-readable half.
      return rpcError(404, -32001, "Unknown or expired MCP session. Initialize a new session.");
    }
    if (session.subject !== caller.principal.sub) {
      // A valid token is not a claim on someone else's session. Without this, a session id — which
      // travels in a header and is not a secret — would be enough to read another person's case.
      return rpcError(403, -32003, "This session belongs to another account.");
    }
    session.authorization = caller.authorization;
    return session.transport.handleRequest(req, { authInfo: authInfoOf(caller) });
  }

  if (req.method !== "POST") {
    return rpcError(400, -32000, "Mcp-Session-Id header required.");
  }

  // Read the body once: the transport takes it back as `parsedBody` so it is not consumed twice.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(400, -32700, "Parse error: body is not JSON.");
  }
  if (!isInitializeRequest(body)) {
    return rpcError(400, -32000, "First request on a new session must be `initialize`.");
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, {
        id,
        transport,
        server,
        subject: caller.principal.sub,
        authorization: caller.authorization,
        account: null,
        startedAt: Date.now(),
      });
    },
    onsessionclosed: (id) => {
      void endSession(id);
    },
  });
  // Covers the ends the callback above does not: a dropped connection, or a transport error.
  //
  // It does not cover a client that simply walks away: HTTP has no hangup, so a session with no
  // DELETE stays in this map until the process exits. The idle sweep that reaps those belongs
  // with the case TTL and its injectable clock (T009) — one clock, not two.
  transport.onclose = () => {
    if (transport.sessionId) void endSession(transport.sessionId);
  };

  await server.connect(transport);
  return transport.handleRequest(req, { parsedBody: body, authInfo: authInfoOf(caller) });
}
