import { afterEach, describe, expect, it } from "vitest";
import { closeAllSessions, handleMcpRequest, sessionCount, type Caller } from "@/mcp/src/sessions";

const caller = (sub: string): Caller => ({
  principal: { sub, clientId: "sim123", scope: ["openid", "email"], expiresAt: Date.now() + 3_600_000 },
  authorization: `Bearer token-for-${sub}`,
});

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } },
};

const post = (body: unknown, sessionId?: string) =>
  new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

async function openSession(sub: string) {
  const res = await handleMcpRequest(post(INITIALIZE), caller(sub));
  const id = res.headers.get("mcp-session-id");
  // The SSE body stays open until read; draining it lets the transport settle.
  await res.text();
  expect(id).toBeTruthy();
  return id!;
}

afterEach(async () => {
  await closeAllSessions();
});

describe("opening a session", () => {
  it("mints an id on initialize", async () => {
    const id = await openSession("auth0|walter");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessionCount()).toBe(1);
  });

  it("refuses a first request that is not initialize", async () => {
    const res = await handleMcpRequest(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }), caller("auth0|walter"));
    expect(res.status).toBe(400);
    expect(sessionCount()).toBe(0);
  });

  it("refuses an unknown session id", async () => {
    const res = await handleMcpRequest(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "nope"), caller("auth0|walter"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe(-32001);
  });
});

describe("who owns a session", () => {
  it("refuses a valid token belonging to someone else", async () => {
    const id = await openSession("auth0|walter");
    // A session id travels in a plain header and is not a secret. Without this check, holding one
    // plus any valid token of your own would be enough to read another person's case.
    const res = await handleMcpRequest(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, id), caller("auth0|dana"));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toMatch(/another account/);
  });

  it("lets the owner back in", async () => {
    const id = await openSession("auth0|walter");
    const res = await handleMcpRequest(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, id), caller("auth0|walter"));
    expect(res.status).toBe(200);
    await res.text();
  });
});

describe("closing", () => {
  it("drains every session on shutdown", async () => {
    await openSession("auth0|walter");
    await openSession("auth0|dana");
    expect(sessionCount()).toBe(2);
    await closeAllSessions();
    expect(sessionCount()).toBe(0);
  });
});
