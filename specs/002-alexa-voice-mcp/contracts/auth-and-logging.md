# Server auth and scrubbed logging — executable contract (T010)

`mcp/src/auth.ts` verifies the bearer on every request and answers `401` the way the Alexa+ MCP
Toolkit and MCP 2025-11-25 expect; `mcp/src/log.ts` makes sure nothing from a case can reach a log
line (FR-043). Both are pure apart from the JWKS fetch and the `userInfo` call, which are injectable.

**Run on 2026-09-21** with a locally generated RSA key pair standing in for Cognito's JWKS:
34 assertions pass — valid token accepted with its scopes; missing, malformed, garbage, expired,
wrong-issuer, wrong-client, ID-token-instead-of-access-token and **forged-signature** tokens all
refused with the right reason; the `WWW-Authenticate` header and the RFC 9728 document have the
exact shape the conformance test asserts; dev mode accepts only its static bearer; `userInfo` is
called on the configured domain with the caller's own bearer and its `email` is masked for text
and speech; the logger redacts emails, bearers, JWTs, member IDs, denied keys, long strings and big
arrays, and the raw email never appears in any line.

## Facts the code encodes (from `infra/cognito/README.md`)

| Fact | Consequence in code |
|---|---|
| Cognito **access** tokens carry `token_use: "access"`, `client_id` and `scope`, but **no `aud`** and **no `email`** | `jwtVerify` is called with `issuer` only; `token_use` and `client_id ∈ COGNITO_CLIENT_IDS` are checked by hand; `aud` is never expected |
| ID tokens also verify against the same JWKS | `token_use !== "access"` → `wrong_token_use`: an ID token is not accepted as a bearer |
| The email comes from `GET {COGNITO_DOMAIN}/oauth2/userInfo` with the access token, and only if the `email` scope was granted | `fetchAccount` forwards the caller's own `Authorization` header and throws if `email` is absent (the client must request the scope) |
| Alexa+ / MCP clients discover the authorization server from the `401` | `WWW-Authenticate: Bearer resource_metadata="<publicUrl>/.well-known/oauth-protected-resource"`, plus `error="invalid_token"` and a reason when a token was present |
| AgentCore performs the same checks in front of the container | The code is the same locally and deployed; on AgentCore it is a second, identical gate |
| Clock skew | `clockTolerance: 30` seconds; `now` is injectable for tests |

The server wires it as: `verify(req.headers.authorization)` → on failure, `401` with
`unauthorizedHeaders(cfg, reason)` and body `{ error: "unauthorized", reason }`; on success, the
principal is attached to the MCP session and `fetchAccount` runs once per session (cached with
the session, discarded with it).

## Logging rules (FR-043)

- Allowed fields for a tool call: tool name, the first three characters of the case code + `***`,
  status before and after, duration, outcome, error code, input size (`toolCallFields`).
- Denied keys are redacted whatever their value: `email`, `to`, `authorization`, `token`,
  `document`, `base64`, `text`, `letter`, `summary`, `quote`, `facts`, `extraction`, `answers`,
  `situation`, `utterance`, `speak`, `body`, …
- Any string is scrubbed for emails, `Bearer …`, JWTs (`eyJ…`), member/claim-number-shaped
  identifiers, and truncated past 120 characters; arrays over 20 items become `[array n]`.
- Output is one JSON object per line on stderr (CloudWatch-friendly); `child()` binds the session id.

## `mcp/src/auth.ts`

```ts
/**
 * Bearer authentication for the MCP server. Two modes:
 *   cognito (default) — verify an Amazon Cognito access token: signature against the pool's JWKS,
 *                       issuer, token_use = "access", client_id in the allow-list, expiry.
 *   dev               — accept exactly MCP_DEV_BEARER (local runs, CI). Still 401 without it.
 * Unauthenticated → 401 + WWW-Authenticate with resource_metadata (RFC 9728 / MCP 2025-11-25 auth).
 * The email comes from Cognito's userInfo endpoint, once per session, and never leaves the process
 * except as the destination of the letter (masked everywhere else).
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { maskEmail } from "@/lib/voice/spoken";

export type AuthConfig =
  | { mode: "cognito"; issuer: string; clientIds: string[]; domain: string; publicUrl: string; jwks?: JWTVerifyGetKey }
  | { mode: "dev"; bearer: string; email: string; publicUrl: string };

export type Principal = { sub: string; clientId: string; scope: string[]; expiresAt: number };
export type Account = { email: string; emailMasked: string; emailMaskedSpoken: string };

export type AuthResult =
  | { ok: true; principal: Principal }
  | { ok: false; status: 401; reason: "missing" | "malformed" | "invalid" | "expired" | "wrong_issuer" | "wrong_client" | "wrong_token_use" };

export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const publicUrl = (env.MCP_PUBLIC_URL ?? "http://localhost:8000").replace(/\/$/, "");
  if ((env.MCP_AUTH_MODE ?? "cognito") === "dev") {
    if (!env.MCP_DEV_BEARER) throw new Error("MCP_AUTH_MODE=dev requires MCP_DEV_BEARER");
    return { mode: "dev", bearer: env.MCP_DEV_BEARER, email: env.MCP_DEV_EMAIL ?? "dev@example.com", publicUrl };
  }
  const issuer = env.COGNITO_ISSUER, domain = env.COGNITO_DOMAIN, ids = env.COGNITO_CLIENT_IDS;
  if (!issuer || !domain || !ids) throw new Error("cognito auth needs COGNITO_ISSUER, COGNITO_DOMAIN, COGNITO_CLIENT_IDS");
  return { mode: "cognito", issuer: issuer.replace(/\/$/, ""), domain: domain.replace(/\/$/, ""), clientIds: ids.split(",").map((s) => s.trim()).filter(Boolean), publicUrl };
}

/** Reads the bearer from a raw Authorization header value. */
export function extractBearer(authorization: string | null | undefined): string | null {
  const m = authorization?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

export function createVerifier(cfg: AuthConfig) {
  const jwks = cfg.mode === "cognito" ? (cfg.jwks ?? createRemoteJWKSet(new URL(`${cfg.issuer}/.well-known/jwks.json`))) : null;

  return async function verify(authorization: string | null | undefined, now = Date.now()): Promise<AuthResult> {
    const token = extractBearer(authorization);
    if (!token) return { ok: false, status: 401, reason: authorization ? "malformed" : "missing" };

    if (cfg.mode === "dev") {
      return token === cfg.bearer
        ? { ok: true, principal: { sub: "dev", clientId: "dev", scope: ["openid", "email"], expiresAt: now + 3_600_000 } }
        : { ok: false, status: 401, reason: "invalid" };
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks!, { issuer: cfg.issuer, currentDate: new Date(now), clockTolerance: 30 }));
    } catch (e: any) {
      const code = e?.code ?? "";
      if (code === "ERR_JWT_EXPIRED") return { ok: false, status: 401, reason: "expired" };
      if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED" && /iss/.test(String(e?.claim ?? e?.message))) return { ok: false, status: 401, reason: "wrong_issuer" };
      return { ok: false, status: 401, reason: "invalid" };
    }
    // Cognito access tokens: no `aud`; `client_id` and `token_use` instead.
    if (payload.token_use !== "access") return { ok: false, status: 401, reason: "wrong_token_use" };
    const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
    if (!cfg.clientIds.includes(clientId)) return { ok: false, status: 401, reason: "wrong_client" };
    return {
      ok: true,
      principal: { sub: String(payload.sub), clientId, scope: String(payload.scope ?? "").split(" ").filter(Boolean), expiresAt: (payload.exp ?? 0) * 1000 },
    };
  };
}

/** Headers for a 401. `resource_metadata` lets a client discover the authorization server and start PKCE itself. */
export function unauthorizedHeaders(cfg: AuthConfig, reason: AuthResult extends { ok: false } ? AuthResult["reason"] : string): Record<string, string> {
  const rm = `${cfg.publicUrl}/.well-known/oauth-protected-resource`;
  const err = reason === "missing" ? "" : `, error="invalid_token", error_description="${reason}"`;
  return { "WWW-Authenticate": `Bearer resource_metadata="${rm}"${err}`, "Content-Type": "application/json" };
}

/** RFC 9728 document served at /.well-known/oauth-protected-resource. */
export function protectedResourceMetadata(cfg: AuthConfig) {
  return {
    resource: `${cfg.publicUrl}/mcp`,
    authorization_servers: cfg.mode === "cognito" ? [cfg.issuer] : [`${cfg.publicUrl}/dev-auth`],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
    resource_name: "Overturn appeal assistant",
    resource_documentation: "https://github.com/Chinorab/overturn/blob/main/mcp/README.md",
  };
}

/** The linked account's email, fetched once per MCP session. Never logged; masked for every tool result. */
export async function fetchAccount(cfg: AuthConfig, authorization: string, fetchImpl: typeof fetch = fetch): Promise<Account> {
  if (cfg.mode === "dev") return withMask(cfg.email);
  const res = await fetchImpl(`${cfg.domain}/oauth2/userInfo`, { headers: { Authorization: authorization } });
  if (!res.ok) throw new Error(`userInfo ${res.status}`);
  const body = (await res.json()) as { email?: string; email_verified?: string | boolean };
  if (!body.email) throw new Error("userInfo returned no email; the client must request the email scope");
  return withMask(body.email);
}

function withMask(email: string): Account {
  const m = maskEmail(email);
  return { email, emailMasked: m.text, emailMaskedSpoken: m.spoken };
}
```

## `mcp/src/log.ts`

```ts
/**
 * Scrubbed structured logger (FR-043). Logs carry timings, tool names, status transitions, error
 * codes and counts — never document text, extracted facts, letter text, or email addresses.
 * Defence in depth: the scrubber also redacts anything that *looks* like an email, a bearer, a JWT,
 * a long identifier or a large blob, in case a caller passes one by mistake.
 */

export type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const DENY_KEYS = new Set([
  "email", "to", "recipient", "authorization", "bearer", "token", "access_token", "id_token", "refresh_token",
  "document", "base64", "text", "letter", "summary", "quote", "facts", "extraction", "answers", "situation", "utterance", "speak", "body",
]);
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
const BEARER_RE = /\bBearer\s+\S+/gi;
const LONG_ID_RE = /\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{7,}\b/g;   // member/claim numbers
const MAX_STRING = 120;

export function scrub(value: unknown, key = ""): unknown {
  if (DENY_KEYS.has(key.toLowerCase())) return "[redacted]";
  if (typeof value === "string") {
    let s = value.replace(JWT_RE, "[jwt]").replace(BEARER_RE, "Bearer [redacted]").replace(EMAIL_RE, "[email]").replace(LONG_ID_RE, "[id]");
    if (s.length > MAX_STRING) s = `${s.slice(0, 40)}…[${value.length} chars]`;
    return s;
  }
  if (Array.isArray(value)) return value.length > 20 ? `[array ${value.length}]` : value.map((v) => scrub(v));
  if (value && typeof value === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(value as Fields)) out[k] = scrub(v, k);
    return out;
  }
  return value;
}

export type Logger = {
  log: (level: Level, event: string, fields?: Fields) => void;
  info: (event: string, fields?: Fields) => void;
  warn: (event: string, fields?: Fields) => void;
  error: (event: string, fields?: Fields) => void;
  debug: (event: string, fields?: Fields) => void;
  child: (base: Fields) => Logger;
};

export function createLogger(write: (line: string) => void = (l) => process.stderr.write(l + "\n"), base: Fields = {}, clock: () => number = Date.now): Logger {
  const log = (level: Level, event: string, fields: Fields = {}) => {
    const rec = { t: new Date(clock()).toISOString(), level, event, ...scrub({ ...base, ...fields }) as Fields };
    write(JSON.stringify(rec));
  };
  return {
    log,
    info: (e, f) => log("info", e, f),
    warn: (e, f) => log("warn", e, f),
    error: (e, f) => log("error", e, f),
    debug: (e, f) => log("debug", e, f),
    child: (more) => createLogger(write, { ...base, ...more }, clock),
  };
}

/** What a tool call is allowed to log: names, codes, durations, sizes — nothing from the case. */
export function toolCallFields(args: { tool: string; code?: string; status?: string; nextStatus?: string; ms: number; outcome: "ok" | "error" | "needs_confirmation" | "wrong_state"; errorCode?: string; inputBytes?: number }): Fields {
  return { tool: args.tool, case: args.code ? args.code.slice(0, 3) + "***" : undefined, status: args.status, next: args.nextStatus, ms: Math.round(args.ms), outcome: args.outcome, error: args.errorCode, inputBytes: args.inputBytes };
}
```

## Tests (`tests/mcp/auth.test.ts`, `tests/mcp/log.test.ts`)

The run script below is the test file's content; each `eq(label, got, expected)` becomes an `it`.
It builds a fake Cognito (RSA key pair + `createLocalJWKSet`) and injects it through `cfg.jwks`,
so the tests need no network and no AWS account.

```ts
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { createVerifier, loadAuthConfig, extractBearer, unauthorizedHeaders, protectedResourceMetadata, fetchAccount } from "./auth";
import { scrub, createLogger, toolCallFields } from "./log";

let fails = 0;
const eq = (label: string, got: any, exp: any) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.log("FAIL", label, "got", JSON.stringify(got), "expected", JSON.stringify(exp)); }
};

(async () => {
  // ---- a fake Cognito: key pair + local JWKS
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "k1"; jwk.alg = "RS256"; jwk.use = "sig";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const ISS = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123";
  const cfg = loadAuthConfig({ MCP_AUTH_MODE: "cognito", COGNITO_ISSUER: ISS + "/", COGNITO_DOMAIN: "https://overturn-demo.auth.us-east-1.amazoncognito.com", COGNITO_CLIENT_IDS: "sim123, insp456", MCP_PUBLIC_URL: "https://mcp.example.com/" });
  const verify = createVerifier({ ...cfg, jwks } as any);
  const now = Date.parse("2026-10-21T10:00:00Z");
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; exp?: number } = {}) =>
    new SignJWT({ token_use: "access", client_id: "sim123", scope: "openid email profile", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(opts.iss ?? ISS).setSubject("u-1")
      .setIssuedAt(Math.floor(now / 1000)).setExpirationTime(opts.exp ?? Math.floor(now / 1000) + 3600).sign(privateKey);

  eq("missing header", await verify(null, now), { ok: false, status: 401, reason: "missing" });
  eq("malformed header", (await verify("Basic abc", now) as any).reason, "malformed");
  eq("garbage token", (await verify("Bearer not.a.jwt", now) as any).reason, "invalid");
  const good = await sign({});
  const r = await verify(`Bearer ${good}`, now);
  eq("valid token", r.ok && r.principal.clientId, "sim123");
  eq("scope parsed", r.ok && r.principal.scope, ["openid", "email", "profile"]);
  eq("expired", (await verify(`Bearer ${await sign({}, { exp: Math.floor(now / 1000) - 120 })}`, now) as any).reason, "expired");
  eq("wrong issuer", (await verify(`Bearer ${await sign({}, { iss: "https://evil.example.com" })}`, now) as any).reason, "wrong_issuer");
  eq("wrong client", (await verify(`Bearer ${await sign({ client_id: "other" })}`, now) as any).reason, "wrong_client");
  eq("id token rejected", (await verify(`Bearer ${await sign({ token_use: "id" })}`, now) as any).reason, "wrong_token_use");
  // token signed by another key
  const { privateKey: rogue } = await generateKeyPair("RS256");
  const forged = await new SignJWT({ token_use: "access", client_id: "sim123" }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(ISS).setSubject("x").setIssuedAt(Math.floor(now / 1000)).setExpirationTime(Math.floor(now / 1000) + 60).sign(rogue);
  eq("forged signature", (await verify(`Bearer ${forged}`, now) as any).reason, "invalid");

  // ---- 401 headers and metadata
  const h = unauthorizedHeaders(cfg, "missing");
  eq("www-authenticate", h["WWW-Authenticate"], 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"');
  eq("www-authenticate with error", unauthorizedHeaders(cfg, "expired")["WWW-Authenticate"].includes('error="invalid_token", error_description="expired"'), true);
  const meta = protectedResourceMetadata(cfg);
  eq("prm resource", meta.resource, "https://mcp.example.com/mcp");
  eq("prm issuer", meta.authorization_servers, [ISS]);

  // ---- dev mode
  const dev = loadAuthConfig({ MCP_AUTH_MODE: "dev", MCP_DEV_BEARER: "local-dev-token", MCP_DEV_EMAIL: "walter.demo@example.com" });
  const vdev = createVerifier(dev);
  eq("dev ok", (await vdev("Bearer local-dev-token")).ok, true);
  eq("dev wrong", (await vdev("Bearer nope") as any).reason, "invalid");
  eq("dev missing", (await vdev(undefined) as any).reason, "missing");
  let threw = false; try { loadAuthConfig({ MCP_AUTH_MODE: "dev" }); } catch { threw = true; } eq("dev needs bearer", threw, true);
  threw = false; try { loadAuthConfig({}); } catch { threw = true; } eq("cognito needs env", threw, true);

  // ---- account / userInfo
  const acc = await fetchAccount(dev, "Bearer local-dev-token");
  eq("dev account masked", [acc.emailMasked, acc.emailMaskedSpoken], ["w•••@example.com", "w-dot-example-dot-com"]);
  const fakeFetch = (async (url: string, init: any) => {
    eq("userInfo url", url, "https://overturn-demo.auth.us-east-1.amazoncognito.com/oauth2/userInfo");
    eq("userInfo forwards bearer", init.headers.Authorization, `Bearer ${good}`);
    return new Response(JSON.stringify({ sub: "u-1", email: "dana@outlook.com", email_verified: "true" }), { status: 200 });
  }) as any;
  const acc2 = await fetchAccount(cfg, `Bearer ${good}`, fakeFetch);
  eq("cognito account", [acc2.email, acc2.emailMasked, acc2.emailMaskedSpoken], ["dana@outlook.com", "d•••@outlook.com", "d-dot-outlook-dot-com"]);
  threw = false; try { await fetchAccount(cfg, "Bearer x", (async () => new Response("{}", { status: 200 })) as any); } catch { threw = true; } eq("no email → throws", threw, true);
  eq("extractBearer", extractBearer("bearer   abc"), "abc");

  // ---- log scrubbing
  const lines: string[] = [];
  const log = createLogger((l) => lines.push(l), { service: "mcp" }, () => now);
  log.info("tool_call", toolCallFields({ tool: "overturn_send_letter", code: "ACF347", status: "letter_drafted", nextStatus: "sent", ms: 12.6, outcome: "ok" }));
  log.warn("oops", { email: "dana@outlook.com", note: "send to dana@outlook.com with Bearer eyJabc.def.ghi and member PCH-5590213", authorization: "Bearer zzz", text: "x".repeat(500), list: Array(50).fill(1) });
  const l0 = JSON.parse(lines[0]); const l1 = JSON.parse(lines[1]);
  eq("case code truncated", l0.case, "ACF***");
  eq("ms rounded", l0.ms, 13);
  eq("email key redacted", l1.email, "[redacted]");
  eq("email in text redacted", l1.note.includes("dana@"), false);
  eq("bearer/jwt redacted", /eyJ|zzz/.test(l1.note + l1.authorization), false);
  eq("member id redacted", l1.note.includes("5590213"), false);
  eq("long string truncated", l1.text, "[redacted]");
  eq("big array summarized", l1.list, "[array 50]");
  eq("no raw email anywhere", lines.join("\n").includes("dana@outlook.com"), false);

  console.log(fails ? `${fails} failures` : "all passed");
})();
```
