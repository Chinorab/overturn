/**
 * Bearer authentication for the MCP server. Two modes:
 *   oidc (default) — verify an OAuth 2.1 / OIDC access token: signature against the authorization
 *                    server's JWKS, issuer, audience and/or authorized party, expiry.
 *   dev            — accept exactly MCP_DEV_BEARER (local runs, CI). Still 401 without it.
 *
 * Unauthenticated → 401 + WWW-Authenticate with resource_metadata (RFC 9728 / MCP 2025-11-25 auth),
 * which is how an Alexa+ client discovers where to run the PKCE flow.
 *
 * Deliberately not named after a vendor. This file was first written against Cognito, now runs
 * against Auth0, and the Alexa+ Toolkit may yet require a third: what the MCP spec and the Toolkit
 * actually require is a JWT bearer bound to this resource, which is all the code below checks.
 *
 * The email comes from the authorization server's userinfo endpoint, once per session, and never
 * leaves the process except as the destination of the letter (masked everywhere else).
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { maskEmail } from "@/lib/voice/spoken";

export type AuthConfig =
  | {
      mode: "oidc";
      /** Exactly as the tokens carry it. Auth0's issuer ends in a slash; the check is an equality. */
      issuer: string;
      jwksUrl: string;
      userInfoUrl: string;
      /** The API identifier this resource is registered under, checked against `aud`. */
      audience: string | null;
      /** Allow-list checked against `azp` (Auth0) or `client_id` (Cognito). */
      clientIds: string[];
      publicUrl: string;
      jwks?: JWTVerifyGetKey;
    }
  | { mode: "dev"; bearer: string; email: string; publicUrl: string };

export type Principal = { sub: string; clientId: string; scope: string[]; expiresAt: number };
export type Account = { email: string; emailMasked: string; emailMaskedSpoken: string };

export type AuthFailureReason =
  | "missing"
  | "malformed"
  | "invalid"
  | "expired"
  | "wrong_issuer"
  | "wrong_audience"
  | "wrong_client";

export type AuthResult =
  | { ok: true; principal: Principal }
  | { ok: false; status: 401; reason: AuthFailureReason };

/** Joins a base URL that may or may not end in a slash to a path. Auth0's issuer does. */
const join = (base: string, path: string) => `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const publicUrl = (env.MCP_PUBLIC_URL ?? "http://localhost:8000").replace(/\/$/, "");

  if ((env.MCP_AUTH_MODE ?? "oidc") === "dev") {
    if (!env.MCP_DEV_BEARER) throw new Error("MCP_AUTH_MODE=dev requires MCP_DEV_BEARER");
    return { mode: "dev", bearer: env.MCP_DEV_BEARER, email: env.MCP_DEV_EMAIL ?? "dev@example.com", publicUrl };
  }

  const issuer = env.OIDC_ISSUER;
  if (!issuer) throw new Error("oidc auth needs OIDC_ISSUER");
  const audience = env.OIDC_AUDIENCE?.trim() || null;
  const clientIds = (env.OIDC_CLIENT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Without one of these, any token the authorization server ever issued — for any application —
  // would open this server. One binding to this resource is the minimum.
  if (!audience && clientIds.length === 0) {
    throw new Error("oidc auth needs OIDC_AUDIENCE or OIDC_CLIENT_IDS: a token must be bound to this resource");
  }

  return {
    mode: "oidc",
    issuer,
    jwksUrl: env.OIDC_JWKS_URL ?? join(issuer, ".well-known/jwks.json"),
    userInfoUrl: env.OIDC_USERINFO_URL ?? join(issuer, "userinfo"),
    audience,
    clientIds,
    publicUrl,
  };
}

/** Reads the bearer from a raw Authorization header value. */
export function extractBearer(authorization: string | null | undefined): string | null {
  const m = authorization?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

export function createVerifier(cfg: AuthConfig) {
  const jwks = cfg.mode === "oidc" ? (cfg.jwks ?? createRemoteJWKSet(new URL(cfg.jwksUrl))) : null;

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
      // `audience` is given to jose when we have one, so the check happens inside the verification
      // rather than after it — one place, and it cannot be forgotten on a later edit.
      ({ payload } = await jwtVerify(token, jwks!, {
        issuer: cfg.issuer,
        ...(cfg.audience ? { audience: cfg.audience } : {}),
        currentDate: new Date(now),
        clockTolerance: 30,
      }));
    } catch (e: unknown) {
      return { ok: false, status: 401, reason: failureReason(e) };
    }

    // Auth0 puts the calling application in `azp`; Cognito uses `client_id`. Either satisfies the
    // allow-list, when one is configured.
    const clientId =
      (typeof payload.azp === "string" && payload.azp) ||
      (typeof payload.client_id === "string" && payload.client_id) ||
      "";
    if (cfg.clientIds.length > 0 && !cfg.clientIds.includes(clientId)) {
      return { ok: false, status: 401, reason: "wrong_client" };
    }

    return {
      ok: true,
      principal: {
        sub: String(payload.sub),
        clientId,
        scope: scopesOf(payload),
        expiresAt: (payload.exp ?? 0) * 1000,
      },
    };
  };
}

/** Both spellings appear in the wild: a space-delimited `scope`, or an array in `scp`. */
function scopesOf(payload: JWTPayload): string[] {
  if (typeof payload.scope === "string") return payload.scope.split(" ").filter(Boolean);
  if (Array.isArray(payload.scp)) return payload.scp.filter((s): s is string => typeof s === "string");
  return [];
}

function failureReason(e: unknown): AuthFailureReason {
  const err = e as { code?: string; claim?: string; message?: string };
  if (err?.code === "ERR_JWT_EXPIRED") return "expired";
  if (err?.code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    if (err.claim === "iss") return "wrong_issuer";
    if (err.claim === "aud") return "wrong_audience";
  }
  // Everything else — a bad signature above all — is just "invalid": telling a caller *why* their
  // forged token failed is telling them how to forge a better one.
  return "invalid";
}

/** Headers for a 401. `resource_metadata` lets a client discover the authorization server and start PKCE itself. */
export function unauthorizedHeaders(cfg: AuthConfig, reason: AuthFailureReason): Record<string, string> {
  const rm = `${cfg.publicUrl}/.well-known/oauth-protected-resource`;
  const err = reason === "missing" ? "" : `, error="invalid_token", error_description="${reason}"`;
  return { "WWW-Authenticate": `Bearer resource_metadata="${rm}"${err}`, "Content-Type": "application/json" };
}

/** RFC 9728 document served at /.well-known/oauth-protected-resource. */
export function protectedResourceMetadata(cfg: AuthConfig) {
  return {
    resource: `${cfg.publicUrl}/mcp`,
    authorization_servers: cfg.mode === "oidc" ? [cfg.issuer] : [`${cfg.publicUrl}/dev-auth`],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
    resource_name: "Overturn appeal assistant",
    resource_documentation: "https://github.com/Chinorab/overturn/blob/main/mcp/README.md",
  };
}

/** The linked account's email, fetched once per MCP session. Never logged; masked for every tool result. */
export async function fetchAccount(cfg: AuthConfig, authorization: string, fetchImpl: typeof fetch = fetch): Promise<Account> {
  if (cfg.mode === "dev") return withMask(cfg.email);
  const res = await fetchImpl(cfg.userInfoUrl, { headers: { Authorization: authorization } });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  const body = (await res.json()) as { email?: string };
  if (!body.email) throw new Error("userinfo returned no email; the client must request the email scope");
  return withMask(body.email);
}

function withMask(email: string): Account {
  const m = maskEmail(email);
  return { email, emailMasked: m.text, emailMaskedSpoken: m.spoken };
}
