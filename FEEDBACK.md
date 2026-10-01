# Product Feedback — Build, Ship, Shape: Amazon Developer Hackathon

Feedback on every tool, SDK, API and service used to build the Alexa+ track entry
(feature `002-alexa-voice-mcp`), written as each one is first used and completed before
submission. Each entry follows the same five headings the hackathon asks for. Blocking
problems are cross-referenced to `FRICTION_LOG.md` (entries `#n`).

Status legend: ⏳ not yet used · 🔧 in use · ✅ complete

| Tool / service | Role in the project | Status | Would reuse |
|---|---|---|---|
| [Alexa+ MCP Toolkit & docs](#alexa-mcp-toolkit--developer-docs) | Target platform; integration requirements | 🔧 (docs only) | — |
| [MCP TypeScript SDK 1.30](#mcp-typescript-sdk) | Server + client, Streamable HTTP, auth middleware | ⏳ | — |
| [MCP Inspector](#mcp-inspector) | Manual testing, judge walkthrough | ⏳ | — |
| [Hono](#hono) | HTTP layer of the MCP server | ⏳ | — |
| [Amazon Cognito](#amazon-cognito) | OAuth 2.1 PKCE authorization server, account linking | ⏳ | — |
| [Amazon Bedrock AgentCore Runtime + `agentcore` CLI](#amazon-bedrock-agentcore-runtime) | Hosting the MCP server | ⏳ | — |
| [Amazon SES v2](#amazon-ses-v2) | Letter delivery by email | ⏳ | — |
| [Amazon Polly](#amazon-polly) | Assistant voice in the simulator | ⏳ | — |
| [Web Speech API](#web-speech-api) | Speech recognition in the simulator | ⏳ | — |
| [Anthropic SDK / Claude](#anthropic-sdk--claude) | Default model: extraction, drafting, orchestration | 🔧 (since feature 001) | — |
| [Nebius Token Factory / Nemotron](#nebius-token-factory--nvidia-nemotron) | Second provider | ⏳ | — |
| [Vercel](#vercel) | Web app + simulator hosting | 🔧 (since feature 001) | — |
| [Devpost](#devpost) | Submission | ⏳ | — |

Template for each section:

> **Usage** — what we used it for, which parts of the API.
> **What worked** — concrete wins.
> **What did not** — concrete problems, with friction-log reference.
> **Onboarding quality** — first-hour experience, docs, examples, error messages (1–5).
> **Would I reuse it?** — yes / no / only if, and why.

---

## Alexa+ MCP Toolkit & developer docs

**Usage** — Read to define the integration contract the MCP server is built to: Streamable
HTTP, remote URL, `401` for unauthenticated requests, OAuth 2.1 authorization code + PKCE,
< 500 ms round trip, `alexa-ai` CLI flow (`configure` → `new mcp` → `deploy` → `submit`),
web simulator. Not executed: access is partner-only.

**What worked** — The QuickStart is precise about server-side requirements; it was enough to
design a server that should connect without code changes. The Account Linking page maps
cleanly onto a standard OIDC provider.

**What did not** — The only statement of eligibility ("available to select partners working
directly with our team") lives on a marketing page, not in the docs; the QuickStart reads as
if any developer account can run it. No request-access form. See friction `#1`.

**Onboarding quality** — Docs 4/5 for content, 2/5 for expectation-setting. Overall 2/5
because the described path cannot be started.

**Would I reuse it?** — Yes, the day it opens: the contract is standard and small. Until then
the honest label is "built to spec, not verified on device".

---

## MCP TypeScript SDK

**Usage** — `WebStandardStreamableHTTPServerTransport`, stateful sessions *(done, T003)*;
`registerTool` with zod schemas + `structuredContent`, `bearerAuth` middleware and
protected-resource metadata *(T010–T013)*; on the client side `Client` +
`StreamableHTTPClientTransport` in the simulator's orchestrator and in the conformance test.
Version 1.30.0 (`LATEST_PROTOCOL_VERSION = '2025-11-25'`).

**What worked** — The web-standard transport takes a `Request` and returns a `Response`, so
mounting it on Hono is a single line and the same code would run unchanged on Workers or Deno;
that decision is why the server has no framework lock-in. Protocol negotiation needs no code at
all: a client asking for `2025-11-25` gets it. The session lifecycle exposes the hooks you
actually need — `onsessioninitialized`, `onsessionclosed`, `transport.onclose` — which is what
lets an in-memory-only design promise that a case dies with its session.

**What did not** — The stateful usage example shares one transport across callers, which is
incorrect and fails only under a second client; and reading the request body before
`handleRequest` silently breaks it unless you find `parsedBody` on a different interface. Both
cost about 40 minutes on day one — see FRICTION_LOG #2. Found later in a review rather than lost
to: the spec's Streamable HTTP section says servers **MUST** validate `Origin`, the transport's
`allowedOrigins` option that did this is deprecated in favour of "external middleware", and no
such middleware ships for the web-standard transport. So a server built from the documented
example is non-conformant by default, silently; mine was until 1 October. The types are good enough that both
problems *could* have been compile-time errors rather than runtime surprises.

**Onboarding quality** — The `.d.ts` files are the best documentation in the package: thorough,
honest about trade-offs, and the place I ended up reading instead of the README. That is a
compliment to the types and a complaint about everything else.

**Would I reuse it?** — Yes, without hesitation for the transport layer. The one change I would
ask for is that the examples show the shape that survives a second user.

---

## MCP Inspector

**Usage** — *(T016)* Streamable HTTP connection with a bearer, tool listing, manual case
walkthrough for the judge screenshots.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Hono

**Usage** — *(T003)* HTTP app around the web-standard MCP transport, `/healthz`,
`/.well-known/oauth-protected-resource`, Node adapter on port 8000.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Amazon Cognito

**Usage** — *Evaluated and dropped at T010.* Intended as the OAuth 2.1 authorization server in
front of the MCP endpoint (user pool, hosted domain, public PKCE clients for the simulator and
the MCP Inspector); `infra/cognito/setup.sh` and the first version of `mcp/src/auth.ts` were
written against it.

**What worked** — The access-token claims are clean and well documented, the JWKS endpoint is
where you expect it, and `jose` verifies the tokens with no special casing. Writing the verifier
took under an hour, and the CLI setup script was straightforward.

**What did not** — No RFC 7591 dynamic client registration, which is how MCP 2025-11-25 expects
an unknown client to onboard after reading the `WWW-Authenticate` header. The discovery chain
works to the last step and then requires the operator to create a client by hand. That makes
Cognito unusable for a public MCP endpoint that judges or third-party clients should be able to
connect to. See FRICTION_LOG #3. Two smaller things: access tokens carry no `aud`, so a resource
server must hand-check `client_id` instead of relying on audience validation; and the email is
only reachable through a second call to `oauth2/userInfo`.

**Onboarding quality** — Good docs for the classic web-app case, thin for "I am a resource server
and a client I have never met wants in".

**Would I reuse it?** — For a first-party app with known clients, yes. For an MCP server, not
until dynamic client registration exists.

## Auth0

**Usage** — The OAuth 2.1 authorization server for the MCP endpoint from T010 onward, chosen over
Cognito for RFC 7591 dynamic client registration. Authorization code + PKCE (S256), JWT access
tokens verified against the tenant JWKS, email from `/userinfo`.

**What worked** — *(T010)* The token shape is the ordinary OIDC one — `iss`, `aud`, `azp`, `exp`,
`scope` — so `jose` validates issuer and audience inside `jwtVerify` rather than in hand-written
checks afterwards. One fewer place to forget something.

**What did not** — *(T010)* The issuer ends in a trailing slash and the comparison is an equality,
so the habit of normalising base URLs by stripping the last slash breaks every token. It cost a
few minutes and a test named after it. *(Tenant setup: T005, not done yet.)*

**Onboarding quality** — *(to fill at T005)*

**Would I reuse it?** — *(to fill at T005)*

## Amazon Bedrock AgentCore Runtime

**Usage** — *(T005, T028, T029)* Hosting the MCP server container (ARM64, `0.0.0.0:8000/mcp`),
stateful streamable HTTP, `CUSTOM_JWT` inbound authorizer on Cognito, invocation URL used by
the simulator; `agentcore` CLI (`create`, `add agent --protocol MCP`, `deploy`) or
`create-agent-runtime` from an ECR image.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Amazon SES v2

**Usage** — *(T005, T020)* `SendEmail` with Simple content and attachments (letter PDF +
one-page summary PDF), verified sender identity, sandbox → production access request.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Amazon Polly

**Usage** — *(T022)* Neural en-US voice for the simulated assistant, SSML breaks, streamed
MP3 from a Next.js route, browser `speechSynthesis` fallback.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Web Speech API

**Usage** — *(T021)* `SpeechRecognition` in Chrome/Edge for the simulator's microphone:
interim results, end-of-speech detection, wake-word stripping, barge-in.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Anthropic SDK / Claude

**Usage** — Since feature 001: `messages.parse` with `zodOutputFormat` for extraction
(PDF/image input), explanation and letter drafting; in 002 also tool use for the simulator's
orchestrator behind the provider interface (`lib/ai/providers/anthropic.ts`).

**What worked** — *(carry over from 001)* Native PDF and image input removed any OCR pipeline;
structured outputs with zod made the strict schema layer cheap. *(002, T006)* Putting the SDK
behind an interface took under an hour, because `messages.parse` already has the shape the rest
of the product wanted: system, user, schema, out. The error classes are specific enough
(`RateLimitError`, `APIConnectionError`, `InternalServerError`, `AuthenticationError`) that
translating them into provider-neutral ones was a five-line function with no guesswork.

**What did not** — `zodOutputFormat` takes only the schema, with no way to name it. Every other
structured-output API I am targeting (OpenAI-compatible, which is what Nebius speaks) requires a
schema *name*, so the name has to live outside the SDK's format helper and be carried separately.
Minor, but it means the seam's request type has a field the default provider ignores.

**Onboarding quality** — Good. `messages.parse` is discoverable from the types and behaves the
way the name suggests.

**Would I reuse it?** — Yes. The reason the provider seam exists at all is portability for a
second submission, not dissatisfaction with this one.

---

## Nebius Token Factory / NVIDIA Nemotron

**Usage** — *(T033)* OpenAI-compatible endpoint, `response_format: json_schema`,
Nemotron 3 Nano 30B for extraction and explanation, Super 120B for drafting; PDF text
extracted locally because the models are text-only.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Vercel

**Usage** — Hosting of the web app since feature 001; in 002 the simulator (`/sim`,
`/companion`) and its server routes (orchestrator, TTS proxy, companion upload) with the
AWS/Cognito/MCP values as project environment variables.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —

---

## Devpost

**Usage** — *(T039)* Submission form, gallery, video link, feedback and friction-log fields.

**What worked** —

**What did not** —

**Onboarding quality** —

**Would I reuse it?** —
