# Friction Log — Build, Ship, Shape: Amazon Developer Hackathon

Recorded as each friction happens, not reconstructed afterwards. Track: Alexa+.
Severity: **Blocker** (no workaround inside the track's stated path) · **High** (hours lost or
path changed) · **Medium** (under an hour, workaround exists) · **Low** (annoyance).

| # | Date | Task attempted | Severity | Status |
|---|---|---|---|---|
| 1 | 2026-09-21 | Get access to the Alexa+ MCP Toolkit / web simulator to test a self-hosted MCP server | Blocker | Worked around (simulated path) |
| 2 | 2026-09-28 | Mount `WebStandardStreamableHTTPServerTransport` on Hono in stateful mode (T003) | Medium | Worked around (session registry) |
| 3 | 2026-09-28 | Use Amazon Cognito as the OAuth 2.1 server for an MCP 2025-11-25 endpoint (T010) | High | Changed path (Auth0) |

---

## 1 — Alexa+ MCP Toolkit is partner-only; the track's primary path is not reachable by an individual developer

**Date**: 2026-09-21 (pre-window research, before the 2026-09-28 start)

**Task attempted**: Follow the Alexa+ MCP QuickStart (`alexa-ai configure` → `alexa-ai new mcp`
→ `deploy` → web simulator) to connect a self-hosted MCP server, as the Alexa+ track describes.

**Steps**:
1. Read the Devpost track page: "Build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP)".
2. Read `developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html` — full CLI flow, server requirements (Streamable HTTP, public URL, 401 + OAuth 2.1 PKCE, < 500 ms), web simulator.
3. Read `developer.amazon.com/alexaplus/` — "Alexa+ for Builders is currently available to select partners working directly with our team."
4. Read the July 2026 blog — "The integration paths are currently available in Preview."
5. Looked for a request-access form or waitlist: none on the developer portal.

**Expected**: A developer account is enough to register an add-on and test it in the web
simulator, as the QuickStart implies ("you authenticate with your Alexa developer account").

**Actual**: The QuickStart documents a flow that an individual cannot start; the only public
statement of eligibility is on a marketing page, not in the docs. The Devpost page anticipates
this with an alternative ("Build a simulated Alexa+ experience in a web app using your preferred
agentic tool") but does not say *why* one would need it, so a participant can spend hours on the
QuickStart before finding the eligibility sentence.

**Workaround**: Build the MCP server to the QuickStart's published requirements anyway
(Streamable HTTP, 401 on unauthenticated, OAuth 2.1 PKCE, sub-500 ms for non-model calls), and
build a simulated Alexa+ web app that drives it through a real MCP client. Document a "when
access opens" checklist instead of a device deployment.

**Suggestion**:
- Put the eligibility statement ("select partners", "Preview") at the top of the QuickStart and
  the Toolkit overview, with a link to a request-access form.
- On the Devpost track page, state plainly that the Toolkit is not open during the hackathon and
  make the simulated path the documented default, with a reference simulator or a spec for what
  "simulated Alexa+ experience" should demonstrate (voice in/out? transcript? account linking?).
- Offer hackathon participants a time-boxed sandbox add-on ID for the web simulator.

---

## 2 — The SDK's own Hono example is wrong for stateful mode, and the body-reuse trap is undocumented

**Date**: 2026-09-28 (T003, first day of the window)

**Task attempted**: Serve the MCP endpoint with
`WebStandardStreamableHTTPServerTransport` on Hono, stateful, as the Alexa+ QuickStart requires
(the Toolkit propagates `Mcp-Session-Id`, so the server must mint and honour one).

**Steps**:
1. Copied the usage example from the transport's own docstring in
   `@modelcontextprotocol/sdk@1.30.0` (`server/webStandardStreamableHttp.d.ts`): it constructs a
   stateful transport with `sessionIdGenerator: () => crypto.randomUUID()`, then mounts
   `app.all('/mcp', async (c) => transport.handleRequest(c.req.raw))`.
2. Needed to tell an `initialize` on a new session apart from a request on an existing one, so
   read the JSON body to call `isInitializeRequest`.

**Expected**: The documented example is the shape to build on.

**Actual**: Two problems, neither stated where a reader meets them.
- The example shares **one** transport and **one** `McpServer` across every caller. In stateful
  mode a transport *is* a session: it holds `sessionId`, the stream mapping and the initialised
  flag. A second client's `initialize` walks over the first. Nothing warns you; with one client
  it looks correct, which is exactly how it reaches production.
- Reading the body yourself consumes the `Request`, and `handleRequest` then fails on its own
  `req.json()`. The fix exists — `HandleRequestOptions.parsedBody` — but it is documented on a
  separate interface, not in the example that leads you into the problem.

**Workaround**: `mcp/src/sessions.ts` — a `Map<sessionId, {transport, server}>`, a new
transport + `McpServer` per `initialize`, lookup by the `mcp-session-id` header, `404 -32001`
for an unknown id, and `endSession` wired to both `onsessionclosed` (DELETE) and
`transport.onclose` (dropped connection). The parsed body is handed back via `parsedBody`.

**Cost**: about 40 minutes, most of it reading the transport's source to confirm that a transport
is per-session rather than per-server.

**Suggestion**:
- Make the docstring's stateful example the registry pattern, since that is the only correct one;
  keep the single-transport snippet for the stateless case, labelled as such.
- Say in `handleRequest`'s own docs that reading the body before calling it requires `parsedBody`.
- Consider throwing a clear error when a stateful transport receives a second `initialize`,
  instead of silently reassigning the session.

---

## 3 — Amazon Cognito cannot serve an MCP 2025-11-25 endpoint the way the spec expects clients to connect

**Date**: 2026-09-28 (T010)

**Task attempted**: Use Cognito as the authorization server behind the MCP endpoint, as
`infra/cognito/setup.sh` was written to do, so that an arbitrary MCP client — the Inspector, a
judge's own client, eventually Alexa+ — could connect to the deployed server.

**Steps**:
1. Wrote `mcp/src/auth.ts` against Cognito access tokens: `token_use: "access"`, `client_id`,
   `scope`, no `aud`, JWKS at `{issuer}/.well-known/jwks.json`, email from
   `{domain}/oauth2/userInfo`. 34 assertions pass against a local RSA key pair.
2. Went to connect a client that the server operator has not met, which is the case the MCP auth
   spec is built around: the client reads `WWW-Authenticate: Bearer resource_metadata=…`, fetches
   the RFC 9728 document, finds the authorization server, and **registers itself** (RFC 7591
   dynamic client registration) before starting the PKCE flow.

**Expected**: A managed identity provider offered as *the* AWS answer for OAuth would support
dynamic client registration, or at least document what to do instead for this case.

**Actual**: Cognito has no dynamic client registration. Every client must be created in advance
in the user pool, by the operator, with its redirect URIs known ahead of time. For a hackathon
judge who wants to point their own MCP client at the server, that means: contact me, wait for me
to add a client ID, and use it. The spec's discovery chain works right up to the last step and
then stops.

**Workaround**: Auth0, which does support RFC 7591. `auth.ts` was rewritten to be
provider-neutral — issuer, JWKS URL, userinfo URL, `aud` and `azp`/`client_id` all come from
configuration, and both the Auth0 and Cognito claim spellings are accepted. The Cognito scripts in
`infra/cognito/` are kept but are no longer the documented path.

**Cost**: about an hour to rewrite and re-test the verifier, plus the earlier work on
`infra/cognito/`.

**Suggestion**:
- Support RFC 7591 dynamic client registration in Cognito, even if gated behind a scope or a
  rate limit. Without it, Cognito cannot be the authorization server for a *public* MCP endpoint,
  which is a shape AWS presumably wants to host.
- Until then, say so on the Cognito page next to the OAuth 2.1 claims, and in the Alexa+ MCP
  Toolkit QuickStart, which tells builders to use OAuth 2.1 + PKCE without naming a provider that
  actually completes the discovery chain.
