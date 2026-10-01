import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_SESSIONS_PER_SUBJECT,
  closeAllSessions,
  handleMcpRequest,
  sessionAccount,
  sessionCount,
  sweepSessions,
  type Caller,
} from "@/mcp/src/sessions";
import { IDLE_TTL_MS, SESSION_IDLE_TTL_MS } from "@/mcp/src/clock";
import type { AuthConfig } from "@/mcp/src/auth";

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

describe("idle sessions", () => {
  it("are ended once idle past the session TTL, taking the bearer and the email with them", async () => {
    await openSession("auth0|walter");
    expect(sessionCount()).toBe(1);
    // Before this sweep existed, a client that walked away without a DELETE left its session —
    // and the bearer and email it holds — in memory for the life of the process.
    expect(await sweepSessions(Date.now() + SESSION_IDLE_TTL_MS + 1)).toBe(1);
    expect(sessionCount()).toBe(0);
  });

  it("outlive their cases, so the person can be told the case expired", async () => {
    await openSession("auth0|walter");
    // At minute 31 the case is gone but the session is not: the tool layer can still say why.
    expect(SESSION_IDLE_TTL_MS).toBeGreaterThan(IDLE_TTL_MS);
    expect(await sweepSessions(Date.now() + IDLE_TTL_MS + 60_000)).toBe(0);
    expect(sessionCount()).toBe(1);
  });

  it("are kept alive by being used", async () => {
    const id = await openSession("auth0|walter");
    const res = await handleMcpRequest(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, id), caller("auth0|walter"));
    await res.text();
    expect(await sweepSessions(Date.now() + 60_000)).toBe(0);
  });
});

describe("limits", () => {
  it(`refuses a ${MAX_SESSIONS_PER_SUBJECT + 1}th session for one account, but not for another`, async () => {
    for (let i = 0; i < MAX_SESSIONS_PER_SUBJECT; i++) await openSession("auth0|walter");
    const res = await handleMcpRequest(post(INITIALIZE), caller("auth0|walter"));
    expect(res.status).toBe(429);
    expect(sessionCount()).toBe(MAX_SESSIONS_PER_SUBJECT);
    // One account at its limit does not lock anyone else out.
    await openSession("auth0|dana");
    expect(sessionCount()).toBe(MAX_SESSIONS_PER_SUBJECT + 1);
  });
});

describe("the linked account", () => {
  const OIDC: AuthConfig = {
    mode: "oidc",
    issuer: "https://overturn-demo.eu.auth0.com/",
    jwksUrl: "https://overturn-demo.eu.auth0.com/.well-known/jwks.json",
    userInfoUrl: "https://overturn-demo.eu.auth0.com/userinfo",
    audience: "https://mcp.overturn.example/api",
    clientIds: [],
    publicUrl: "https://mcp.example.com",
  };

  it("retries after a failed lookup instead of remembering the failure", async () => {
    const id = await openSession("auth0|walter");
    let calls = 0;
    const flaky = (async () => {
      calls++;
      if (calls === 1) return new Response("", { status: 503 });
      return new Response(JSON.stringify({ email: "walter.demo@example.com" }), { status: 200 });
    }) as unknown as typeof fetch;

    // One blip at the authorization server used to leave a session that could never send its letter.
    await expect(sessionAccount(id, OIDC, flaky)).rejects.toThrow(/503/);
    const account = await sessionAccount(id, OIDC, flaky);
    expect(account.emailMasked).toBe("w•••@example.com");
    expect(calls).toBe(2);
  });

  it("asks only once when the lookup succeeds", async () => {
    const id = await openSession("auth0|walter");
    let calls = 0;
    const ok = (async () => {
      calls++;
      return new Response(JSON.stringify({ email: "walter.demo@example.com" }), { status: 200 });
    }) as unknown as typeof fetch;
    await sessionAccount(id, OIDC, ok);
    await sessionAccount(id, OIDC, ok);
    expect(calls).toBe(1);
  });
});
