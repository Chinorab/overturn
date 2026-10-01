import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeAllSessions } from "@/mcp/src/sessions";

// createApp reads its auth and origin configuration from the environment when it is called, so
// the environment is set first and the module is imported after.
const ENV = {
  MCP_AUTH_MODE: "dev",
  MCP_DEV_BEARER: "server-test-token",
  MCP_PUBLIC_URL: "https://mcp.example.com",
  MCP_ALLOWED_ORIGINS: "http://localhost:6274",
};

// Typed from createApp itself: `hono` is the mcp package's dependency, not the root's.
let app: ReturnType<typeof import("@/mcp/src/server").createApp>;
let MAX_BODY_BYTES: number;
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  const mod = await import("@/mcp/src/server");
  app = mod.createApp();
  MAX_BODY_BYTES = mod.MAX_BODY_BYTES;
});

afterAll(async () => {
  await closeAllSessions();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const INITIALIZE = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } },
});

const mcp = (headers: Record<string, string> = {}, body: string = INITIALIZE) =>
  app.request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer server-test-token",
      ...headers,
    },
    body,
  });

describe("Origin (MCP 2025-11-25: servers MUST validate it)", () => {
  it("refuses a page on another site with 403, before auth is even consulted", async () => {
    // DNS rebinding: a hostile page that resolves its own name to this server. 403, not 401 —
    // the request is refused for where it comes from, whatever token it carries.
    const res = await mcp({ origin: "https://evil.example.com" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toMatch(/Origin not allowed/);
  });

  it("refuses the literal null origin of a sandboxed frame or a file:// page", async () => {
    expect((await mcp({ origin: "null" })).status).toBe(403);
  });

  it("accepts the server's own public origin", async () => {
    const res = await mcp({ origin: "https://mcp.example.com" });
    expect(res.status).toBe(200);
    await res.text();
  });

  it("accepts an origin added by configuration — the MCP Inspector, locally", async () => {
    const res = await mcp({ origin: "http://localhost:6274" });
    expect(res.status).toBe(200);
    await res.text();
  });

  it("accepts no Origin at all: that is a server-side client, and it still needs its bearer", async () => {
    const res = await mcp();
    expect(res.status).toBe(200);
    await res.text();
    const unauth = await mcp({ authorization: "" });
    expect(unauth.status).toBe(401);
  });
});

describe("request size", () => {
  it("refuses a body over the limit with 413, before parsing it", async () => {
    const huge = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", pad: "x".repeat(MAX_BODY_BYTES) });
    const res = await mcp({}, huge);
    expect(res.status).toBe(413);
    expect((await res.json()).error.message).toMatch(/over \d+ bytes/);
  });

  it("leaves room for a several-page PDF in base64", () => {
    // attach_document carries the document inline. A limit set without thinking would refuse
    // the one request the product exists to accept.
    expect(MAX_BODY_BYTES).toBeGreaterThanOrEqual(8 * 1024 * 1024);
  });
});

describe("/healthz", () => {
  it("publishes counts, not the auth mode", async () => {
    // "dev" on a public endpoint tells a scanner the server runs on a fixed password.
    const body = await (await app.request("/healthz")).json();
    expect(body).not.toHaveProperty("authMode");
    expect(body).toMatchObject({ ok: true, protocol: "2025-11-25", rules: 33 });
    expect(Object.keys(body.cases)).toEqual(["live", "closed", "tombstoned"]);
  });
});

describe("protected-resource metadata", () => {
  it("is served without a token, since it is how a client learns where to get one", async () => {
    const res = await app.request("/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);
    expect((await res.json()).resource).toBe("https://mcp.example.com/mcp");
  });
});
