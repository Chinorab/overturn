import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, type KeyObject } from "jose";
import {
  createVerifier,
  extractBearer,
  fetchAccount,
  loadAuthConfig,
  protectedResourceMetadata,
  unauthorizedHeaders,
  type AuthConfig,
} from "@/mcp/src/auth";

// A stand-in authorization server: an RSA key pair and a local JWKS, injected through `cfg.jwks`.
// No network, no tenant, no account — the verification is the real one either way.
const ISSUER = "https://overturn-demo.eu.auth0.com/"; // Auth0 issuers end in a slash; the check is an equality
const AUDIENCE = "https://mcp.overturn.example/api";
const NOW = Date.parse("2026-10-21T10:00:00Z");
const SECONDS = Math.floor(NOW / 1000);

let privateKey: KeyObject | CryptoKey;
let jwks: JWTVerifyGetKey;
let cfg: AuthConfig;
let verify: ReturnType<typeof createVerifier>;
let validToken: string;

const ENV = {
  MCP_AUTH_MODE: "oidc",
  OIDC_ISSUER: ISSUER,
  OIDC_AUDIENCE: AUDIENCE,
  OIDC_CLIENT_IDS: "sim123, insp456",
  MCP_PUBLIC_URL: "https://mcp.example.com/",
};

/** An access token as Auth0 issues one: `aud` is the API, `azp` is the calling application. */
function sign(claims: Record<string, unknown> = {}, opts: { iss?: string; exp?: number; aud?: unknown } = {}) {
  const jwt = new SignJWT({ azp: "sim123", scope: "openid email profile", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? ISSUER)
    .setSubject("auth0|u-1")
    .setIssuedAt(SECONDS)
    .setExpirationTime(opts.exp ?? SECONDS + 3600);
  if (opts.aud !== null) jwt.setAudience((opts.aud as string) ?? AUDIENCE);
  return jwt.sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = "k1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  jwks = createLocalJWKSet({ keys: [jwk] });
  cfg = { ...loadAuthConfig(ENV), jwks } as AuthConfig;
  verify = createVerifier(cfg);
  validToken = await sign();
});

describe("configuration", () => {
  it("keeps the issuer exactly as the tokens carry it", () => {
    const c = loadAuthConfig(ENV);
    // Stripping the trailing slash would make every real Auth0 token fail the issuer check.
    expect(c.mode === "oidc" && c.issuer).toBe(ISSUER);
  });

  it("derives the JWKS and userinfo URLs without doubling the slash", () => {
    const c = loadAuthConfig(ENV);
    expect(c.mode === "oidc" && c.jwksUrl).toBe("https://overturn-demo.eu.auth0.com/.well-known/jwks.json");
    expect(c.mode === "oidc" && c.userInfoUrl).toBe("https://overturn-demo.eu.auth0.com/userinfo");
  });

  it("refuses to start with no audience and no client allow-list", () => {
    // Otherwise any token the tenant ever issued, for any application, would open this server.
    expect(() => loadAuthConfig({ MCP_AUTH_MODE: "oidc", OIDC_ISSUER: ISSUER })).toThrow(/bound to this resource/);
  });

  it("refuses to start with no issuer", () => {
    expect(() => loadAuthConfig({ MCP_AUTH_MODE: "oidc" })).toThrow(/OIDC_ISSUER/);
  });
});

describe("what is refused", () => {
  it("no header at all", async () => {
    expect(await verify(null, NOW)).toEqual({ ok: false, status: 401, reason: "missing" });
  });

  it("a header that is not a bearer", async () => {
    expect(await verify("Basic abc", NOW)).toMatchObject({ reason: "malformed" });
  });

  it("something that is not a token", async () => {
    expect(await verify("Bearer not.a.jwt", NOW)).toMatchObject({ reason: "invalid" });
  });

  it("an expired token", async () => {
    const token = await sign({}, { exp: SECONDS - 120 });
    expect(await verify(`Bearer ${token}`, NOW)).toMatchObject({ reason: "expired" });
  });

  it("a token from another issuer", async () => {
    const token = await sign({}, { iss: "https://evil.example.com/" });
    expect(await verify(`Bearer ${token}`, NOW)).toMatchObject({ reason: "wrong_issuer" });
  });

  it("a token for another audience", async () => {
    const token = await sign({}, { aud: "https://some-other-api.example/" });
    expect(await verify(`Bearer ${token}`, NOW)).toMatchObject({ reason: "wrong_audience" });
  });

  it("an ID token handed over in place of an access token", async () => {
    // The common mistake, and a real escalation: an ID token is audienced to the *client*, not to
    // this API, so requiring the audience is what refuses it.
    const idToken = await sign({ azp: "sim123", email: "dana@outlook.com" }, { aud: "sim123" });
    expect(await verify(`Bearer ${idToken}`, NOW)).toMatchObject({ reason: "wrong_audience" });
  });

  it("a token from an application that is not on the allow-list", async () => {
    const token = await sign({ azp: "other" });
    expect(await verify(`Bearer ${token}`, NOW)).toMatchObject({ reason: "wrong_client" });
  });

  it("a token signed with the wrong key, without saying why", async () => {
    const { privateKey: rogue } = await generateKeyPair("RS256");
    const forged = await new SignJWT({ azp: "sim123" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("x")
      .setIssuedAt(SECONDS)
      .setExpirationTime(SECONDS + 60)
      .sign(rogue);
    // Plain "invalid": naming the failed check would tell a forger what to fix.
    expect(await verify(`Bearer ${forged}`, NOW)).toMatchObject({ reason: "invalid" });
  });
});

describe("what is accepted", () => {
  it("a well-formed access token, with its scopes", async () => {
    const r = await verify(`Bearer ${validToken}`, NOW);
    expect(r.ok).toBe(true);
    expect(r.ok && r.principal).toMatchObject({
      sub: "auth0|u-1",
      clientId: "sim123",
      scope: ["openid", "email", "profile"],
      expiresAt: (SECONDS + 3600) * 1000,
    });
  });

  it("Cognito's client_id spelling too, so the code survives the next vendor change", async () => {
    const token = await sign({ azp: undefined, client_id: "insp456" });
    expect(await verify(`Bearer ${token}`, NOW)).toMatchObject({ ok: true, principal: { clientId: "insp456" } });
  });

  it("reads the bearer whatever the casing and spacing", () => {
    expect(extractBearer("bearer   abc")).toBe("abc");
    expect(extractBearer("Bearer abc")).toBe("abc");
    expect(extractBearer(null)).toBe(null);
  });
});

describe("the 401 a client learns from", () => {
  it("points at the protected-resource metadata", () => {
    expect(unauthorizedHeaders(cfg, "missing")["WWW-Authenticate"]).toBe(
      'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it("names the reason when a token was actually presented", () => {
    expect(unauthorizedHeaders(cfg, "expired")["WWW-Authenticate"]).toContain(
      'error="invalid_token", error_description="expired"',
    );
  });

  it("publishes an RFC 9728 document pointing at the authorization server", () => {
    const meta = protectedResourceMetadata(cfg);
    expect(meta.resource).toBe("https://mcp.example.com/mcp");
    expect(meta.authorization_servers).toEqual([ISSUER]);
    expect(meta.bearer_methods_supported).toEqual(["header"]);
  });
});

describe("dev mode", () => {
  const dev = loadAuthConfig({ MCP_AUTH_MODE: "dev", MCP_DEV_BEARER: "local-dev-token", MCP_DEV_EMAIL: "walter.demo@example.com" });

  it("accepts its own bearer and nothing else", async () => {
    const v = createVerifier(dev);
    expect((await v("Bearer local-dev-token")).ok).toBe(true);
    expect(await v("Bearer nope")).toMatchObject({ reason: "invalid" });
    // Still 401 without a header: dev mode is a fixed password, not an open door.
    expect(await v(undefined)).toMatchObject({ reason: "missing" });
  });

  it("will not start without a bearer to check against", () => {
    expect(() => loadAuthConfig({ MCP_AUTH_MODE: "dev" })).toThrow(/MCP_DEV_BEARER/);
  });
});

describe("the linked account", () => {
  it("masks the dev email for text and for speech", async () => {
    const dev = loadAuthConfig({ MCP_AUTH_MODE: "dev", MCP_DEV_BEARER: "t", MCP_DEV_EMAIL: "walter.demo@example.com" });
    const acc = await fetchAccount(dev, "Bearer t");
    expect([acc.emailMasked, acc.emailMaskedSpoken]).toEqual(["w•••@example.com", "w-dot-example-dot-com"]);
  });

  it("calls userinfo with the caller's own bearer", async () => {
    const seen: { url?: string; auth?: string } = {};
    const fakeFetch = (async (url: string, init: { headers: Record<string, string> }) => {
      seen.url = url;
      seen.auth = init.headers.Authorization;
      return new Response(JSON.stringify({ sub: "auth0|u-1", email: "dana@outlook.com" }), { status: 200 });
    }) as unknown as typeof fetch;

    const acc = await fetchAccount(cfg, `Bearer ${validToken}`, fakeFetch);
    expect(seen.url).toBe("https://overturn-demo.eu.auth0.com/userinfo");
    expect(seen.auth).toBe(`Bearer ${validToken}`);
    expect([acc.email, acc.emailMasked, acc.emailMaskedSpoken]).toEqual([
      "dana@outlook.com",
      "d•••@outlook.com",
      "d-dot-outlook-dot-com",
    ]);
  });

  it("fails loudly when the email scope was not granted", async () => {
    // Silently continuing would mean a letter with nowhere to go, discovered at the last step.
    const empty = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchAccount(cfg, "Bearer x", empty)).rejects.toThrow(/email scope/);
  });

  it("fails when userinfo refuses", async () => {
    const denied = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    await expect(fetchAccount(cfg, "Bearer x", denied)).rejects.toThrow(/userinfo 403/);
  });
});
