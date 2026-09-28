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
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./mcp";

type Session = {
  id: string;
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
  startedAt: number;
};

const sessions = new Map<string, Session>();

/** Called when a session ends, for whatever reason. The case store (T009) subscribes here. */
type EndHook = (sessionId: string) => void;
const endHooks: EndHook[] = [];

export function onSessionEnd(hook: EndHook): void {
  endHooks.push(hook);
}

export function sessionCount(): number {
  return sessions.size;
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

/**
 * Routes one HTTP request to its session's transport, creating the session on `initialize`.
 *
 * Auth runs before this (T010): by the time we are here the caller is known, and `authInfo` will
 * be threaded through `handleRequest` so tool handlers can read the account.
 */
export async function handleMcpRequest(req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      // Expired, or served by another instance. The client must start over — the person is told
      // in words by the tool layer, this is the machine-readable half.
      return rpcError(404, -32001, "Unknown or expired MCP session. Initialize a new session.");
    }
    return session.transport.handleRequest(req);
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
      sessions.set(id, { id, transport, server, startedAt: Date.now() });
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
  return transport.handleRequest(req, { parsedBody: body });
}
