# Research: Alexa+ Voice Appeal Assistant (MCP)

**Date**: 2026-09-21 · **Feature**: 002-alexa-voice-mcp

Each entry: decision, rationale, alternatives. Items marked **verify D1** are checked on the
first build day (2026-09-28) and logged in `FRICTION_LOG.md` if they fail.

## R1 — Alexa+ integration path

- **Decision**: Simulated Alexa+ experience in a web app, driving a real MCP server through a
  real MCP client. Server built to the Alexa+ MCP Toolkit QuickStart requirements.
- **Rationale**: Alexa+ for Builders is "available to select partners working directly with our
  team" (developer.amazon.com/alexaplus, 2026-09-21). The Devpost track explicitly offers the
  simulated path. Building to the QuickStart contract (Streamable HTTP, remote URL, 401 +
  OAuth 2.1 auth-code PKCE, < 500 ms non-model calls) keeps the server connectable without code
  changes. Logged as friction #1.
- **Alternatives**: (a) request partner access — no form exists; (b) community bridge
  (classic Alexa skill + Strands agent on AgentCore emulating the orchestrator) to reach a real
  Echo — kept as a final-week stretch only; (c) Agent Skill instead of MCP — weaker fit for a
  stateful multi-step case.

## R2 — MCP server runtime and framework

- **Decision**: TypeScript, `@modelcontextprotocol/sdk` **1.30.0** (`LATEST_PROTOCOL_VERSION =
  '2025-11-25'`, verified from the package), **Hono** on Node 22 using the SDK's
  `webStandardStreamableHttp` transport (Fetch-API based), stateful sessions (`Mcp-Session-Id`).
  Lives in `mcp/` as a workspace package, imports the engine from `lib/`.
- **Rationale**: Web-standard transport runs unchanged in a plain Node container (AgentCore,
  App Runner) and locally; Hono is tiny; TypeScript keeps one language and reuses `lib/` schemas
  (zod 4 is supported by SDK 1.30). Stateful mode is required for progress notifications
  (FR-033) and lets the case store live in memory per session.
- **Alternatives**: Next.js route handler hosting the MCP endpoint (ties server lifetime to
  Vercel serverless — no in-memory state, 60 s limits); Python FastMCP (would duplicate the
  engine); Express (heavier, no benefit).
- **Gotcha**: `lib/` modules import `"server-only"`, whose default export throws outside a
  React-server condition. The standalone server runs with `--conditions=react-server` (same
  trick as `scripts/precompute-samples.ts`) or maps `server-only` to an empty module in its
  tsconfig/bundler. **verify D1**.

> **Amendment 2026-09-28 — no AWS account.** R3, R4, R5 and R6 named AWS services to satisfy the
> AWS Builder mini-challenge. There is no AWS account, so that mini-challenge is dropped and the
> providers change: **Auth0** (R3), a **container PaaS** (R4), **Resend** (R5), the browser's
> **speechSynthesis** (R6). Nothing in the Alexa+ track requires AWS. The decisions below are kept
> as written because the *contracts* they produced — 401 + `WWW-Authenticate`, OAuth 2.1 PKCE,
> Streamable HTTP on a public URL, email with two PDF attachments, an assistant voice — are
> unchanged; only the vendor behind each one differs. Each entry ends with its replacement.

## R3 — Authorization (OAuth 2.1 + PKCE, 401)

- **Decision**: **Amazon Cognito user pool** as the authorization server (managed login,
  public client, auth-code + PKCE, self sign-up with verified email). The MCP server is a
  resource server: it validates Cognito JWTs (JWKS, `jose`), returns `401` with
  `WWW-Authenticate: Bearer resource_metadata=…` and serves `/.well-known/oauth-protected-resource`
  (RFC 9728) pointing at the Cognito issuer, via the SDK's `bearerAuth` middleware and
  metadata handlers. The user's email is obtained from Cognito `/oauth2/userInfo` with the access
  token, once per session, and kept in memory only.
- **Rationale**: Exactly what the Alexa+ QuickStart account-linking requires; exactly what
  AgentCore Runtime's `CUSTOM_JWT` authorizer consumes (discovery URL + allowed client IDs), so
  the same tokens work locally and deployed. Counts toward AWS Builder. No password handling in
  our code (Constitution IV, prohibited actions).
- **Alternatives**: SDK demo in-memory OAuth provider (not credible for account linking, not
  accepted by AgentCore); Auth0 (adds a vendor); ProxyOAuthServerProvider in front of Cognito
  (only needed if a client requires dynamic client registration — Cognito has none; documented
  limitation, pre-registered client IDs for the simulator, MCP Inspector and Claude).
- **verify D1**: Cognito managed-login PKCE flow from the simulator; `userInfo` returns `email`.
- **Replacement (2026-09-28)**: **Auth0** free tier. Same shape — issuer, JWKS, `/userinfo`,
  authorization code + PKCE — and one advantage over Cognito: Auth0 supports **dynamic client
  registration**, which MCP clients can use, so a judge's client can register itself instead of
  needing a pre-registered id. `mcp/src/auth.ts` changes only in which claims it reads: Auth0
  access tokens carry `aud` and `azp` rather than Cognito's `client_id`/`token_use`.

## R4 — AWS hosting

- **Decision**: **Amazon Bedrock AgentCore Runtime**, MCP protocol, container image (ARM64),
  `CUSTOM_JWT` authorizer on the Cognito discovery URL, stateful streamable HTTP. Documented
  fallback: the same image on **AWS App Runner** (plain HTTPS URL, in-memory state per
  instance).
- **Rationale**: AgentCore expects MCP containers at `0.0.0.0:8000/mcp`, "supports both
  stateless and stateful streamable-HTTP MCP servers", adds/propagates `Mcp-Session-Id` so a
  client sticks to one runtime session (in-memory case store is safe), and returns the RFC 7235
  `401` itself when the bearer is missing. It is the named AWS Builder service. Lambda is
  rejected: no in-memory continuity between invocations would force a database for PHI
  (FR-040).
- **Risks**: AgentCore CLI examples are Python-first; TypeScript agents via `agentcore add agent
  --language TypeScript` **verify D1**; if unsupported, create the runtime from a pushed ECR
  image with `aws bedrock-agentcore-control create-agent-runtime` (language-agnostic). Region
  `us-east-1`. Free-tier/cost noted in FEEDBACK.md.
- **Replacement (2026-09-28)**: a **container PaaS** — Fly.io, Railway or Render — running the
  same `mcp/Dockerfile`. One always-on instance keeps the in-memory case store valid, which was the
  whole reason AgentCore was chosen over Lambda. The MCP URL becomes a plain
  `https://<app>/mcp`, which is simpler for a judge than an encoded AgentCore ARN.
- **Companion upload consequence**: the phone upload cannot hit the MCP server directly (it
  would land in a different runtime session). The companion page belongs to the simulator web
  app, which holds the MCP session and forwards the document via the `attach_document` tool.
  This is also the right shape for a real Alexa+ client (no upload channel there either).

## R5 — Letter delivery

- **Decision**: **Amazon SES v2** `SendEmail` with Simple content + `Attachments` (PDF letter +
  one-page summary as HTML body), from a verified sender identity; recipient = Cognito email
  only. Fallback: one-time download token served by the simulator app for the remaining session
  (FR-021). Sandbox note: SES sandbox only delivers to verified recipients — the demo account
  emails are verified manually; production access requested week 1 (logged either way).
- **Alternatives**: SES raw MIME (more code); SNS SMS (no attachments, US 10DLC registration);
  Lambda + SES (unneeded hop).
- **Replacement (2026-09-28)**: **Resend** free tier (100 emails/day), attachments supported, no
  sandbox request to wait on — which removes the project's longest external dependency. Same
  constraint as SES's sandbox, though: without a verified sending domain, delivery is limited to
  the account owner's address. **Consequence accepted: the one-time download link becomes the
  primary delivery path for judges, and the email is the path shown in the video.** Both were
  already specified (FR-021); only which one leads changes.

## R6 — Voice in the simulator

- **Decision**: STT = browser **Web Speech API** (`SpeechRecognition`, Chrome/Edge) with a
  typed-input fallback; TTS = **Amazon Polly** neural voice (en-US, conversational) streamed
  from the simulator backend, with `speechSynthesis` fallback. Wake word "Alexa" is matched in
  the transcript, not detected acoustically.
- **Rationale**: Zero-setup STT for a demo; Polly gives a consistent assistant voice for the
  video and adds a documented AWS integration; fallbacks keep the demo alive offline.
- **Alternatives**: Amazon Transcribe streaming (websocket plumbing, no demo gain); Nova Sonic
  speech-to-speech (would replace the orchestrator; too much new surface for 3 weeks).
- **Replacement (2026-09-28)**: the browser's **`speechSynthesis`** only, which was already the
  fallback. Cost: a less consistent voice in the video, and no SSML control over how the case code
  is spelled — `case-code.ts` keeps `ssmlCode()` for the day a real TTS is wired, and the client
  uses `spokenCode()` with punctuation instead.

## R7 — Simulator orchestrator

- **Decision**: A server-side agent loop in the Next.js app (`app/sim`): the LLM (same provider
  abstraction, Anthropic tool use by default) is given the MCP server's tools via
  `@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport`, a persona prompt
  ("Alexa+, voice, one question per turn, ≤ 60 words, read back, confirm"), and the
  confirmation protocol (a tool result of kind `needs_confirmation` must be asked verbatim). No
  private back-channel: the simulator only knows what the tools return (FR-034).
- **Rationale**: This is how Alexa+ would consume the server; it lets judges swap in any MCP
  client. The turn-shape rules are enforced twice — in the prompt and by a post-check that
  truncates/regenerates turns violating FR-001/002 (logged as `turn_violation` metrics).
- **Alternatives**: Deterministic state-machine dialog without an LLM (robust but not
  "Alexa+-like": no free-form understanding); Strands Agents SDK (Python; would split the
  stack — kept as an option for the real-Echo stretch).

## R8 — LLM provider abstraction

- **Decision**: `lib/ai/provider.ts` with one interface: `structured<T>({ system, user,
  schema, attachments?, effort })` and `chatWithTools(...)` (orchestrator). Adapters:
  `anthropic` (current code, PDFs/images native) and `nebius` (OpenAI-compatible
  `https://api.tokenfactory.nebius.com/v1/`, `response_format: json_schema`, default model
  `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for extraction/explain, `nvidia/nemotron-3-super-120b-a12b`
  for drafting). Selected by `OVERTURN_LLM_PROVIDER`.
- **Nebius document handling**: Nemotron 3 is text-only; the nebius adapter extracts PDF text
  with `pdfjs-dist` (the bundled samples are text PDFs) and rejects images with a clear
  `unsupported_on_provider` error unless `NEBIUS_VISION_MODEL` is set. SC-010 is measured on the
  six text samples.
- **Alternatives**: Vercel AI SDK as the abstraction (adds a large dependency and its own
  schema handling; our zod-first code is already close to the metal); Bedrock as a third
  provider (attractive for AWS Builder, deferred — one env var away once the interface exists).

## R9 — Open dataset repository

- **Decision**: New public repo `Chinorab/us-health-appeal-rules` (MIT): `schema.json`
  (generated from `lib/rules/schema.ts`), `rules/{federal,nsa,ca,ny,tx}.json`, `validate.mjs`
  (source_url present, last_verified ≤ 45 days, schema), `CHANGELOG.md`, `docs/adding-a-state.md`,
  README with scope/limitations/citation. Overturn vendors the files under `data/rules/` with a
  `RULES_VERSION` file and a test that diffs against the tagged release (SC-009).
- **Alternatives**: npm package (overkill for JSON); git submodule (friction on Vercel).

## R10 — Case codes

- **Decision**: 6 characters from the Crockford-like alphabet `ABCDEFGHJKMNPQRSTVWXYZ23456789`
  minus phonetic confusions (drop `B/D/E/G/P/T/V/Z` → keep `ACFHJKMNQRWXY234679`), ~86 M
  combinations, spoken in two groups of three ("A-C-F … 3-4-7") with the NATO word offered on
  "repeat". Unique for 24 h in memory.

## R11 — Testing strategy

- Vitest unit tests for the case state machine, code generator, turn-shape checker, provider
  adapters (recorded fixtures); an MCP **conformance test** using the SDK client over
  Streamable HTTP against a spawned server (initialize → list_tools → full sample case →
  assert sources on every rule → 401 without token); Playwright for the simulator's typed-input
  path (speech APIs mocked); five golden transcripts reviewed by hand for SC-005.
