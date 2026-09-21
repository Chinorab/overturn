# overturn-mcp-server

The Overturn appeal engine as a **self-hosted MCP server**: Model Context Protocol
**2025-11-25**, **Streamable HTTP**, stateful sessions, OAuth 2.1 bearer auth (Amazon Cognito).
Built to the [Alexa+ MCP Toolkit](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html)
integration requirements so that an assistant — Alexa+, the bundled simulator at `/sim`, MCP
Inspector, or any standards-compliant client — can guide a person from "my insurance denied my
claim" to a sourced appeal letter in their inbox, one question at a time, with nothing done
without an explicit yes.

**The model reads, the code decides, the human sends — and the assistant asks before it acts.**

> Status: built during the Amazon Build, Ship, Shape Developer Hackathon (2026-09-28 → 2026-10-23).
> The Alexa+ MCP Toolkit is available to select partners only; this server has not been connected
> to a device. See [When Alexa+ access opens](#when-alexa-access-opens).

## Run locally

```bash
pnpm install                          # from the repo root (pnpm workspace)
cp .env.example mcp/.env              # fill the MCP + Cognito + LLM values
pnpm mcp:dev                          # http://localhost:8000/mcp  ·  GET /healthz
```

No AWS yet? Use dev auth:

```bash
MCP_AUTH_MODE=dev MCP_DEV_BEARER=local-dev-token pnpm mcp:dev
```

The server still answers `401` without a bearer; with `Authorization: Bearer local-dev-token` it
accepts calls and uses `MCP_DEV_EMAIL` (default `dev@example.com`) as the linked-account email.

Why `--conditions=react-server`: the engine in `lib/` is shared with the Next.js app and imports
`"server-only"`, whose default export throws outside a React Server environment. The `mcp:dev`,
`mcp:build` scripts and the Dockerfile run Node with `--conditions=react-server` so the package
resolves to its empty variant. Same trick as `scripts/precompute-samples.ts`.

## Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /mcp` | Bearer | JSON-RPC messages (initialize, tools/list, tools/call, …); responses as JSON or SSE per the client's `Accept` |
| `GET /mcp` | Bearer | SSE stream for server-to-client notifications (progress) |
| `DELETE /mcp` | Bearer | End the session (also discards its cases) |
| `GET /.well-known/oauth-protected-resource` | — | RFC 9728 metadata: `authorization_servers: [COGNITO_ISSUER]`, `resource`, scopes |
| `GET /healthz` | — | `{ ok: true, version, protocol: "2025-11-25" }` |

Unauthenticated requests to `/mcp` get `401` with
`WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_URL>/.well-known/oauth-protected-resource"`,
which lets an MCP client discover Cognito and run the authorization-code + PKCE flow itself.

## Authentication

| `MCP_AUTH_MODE` | Behaviour |
|---|---|
| `cognito` (default) | Verifies the JWT signature against `COGNITO_ISSUER/.well-known/jwks.json`, then `iss`, `token_use = access`, `client_id ∈ COGNITO_CLIENT_IDS`, expiry. Fetches the account email once per session from `COGNITO_DOMAIN/oauth2/userInfo`. |
| `dev` | Accepts exactly `MCP_DEV_BEARER`; email = `MCP_DEV_EMAIL`. For local runs and CI only. |

Set up Cognito with `infra/cognito/setup.sh` (pool, domain, three public PKCE clients); get a
test token with `infra/cognito/token.sh <email>`. Details and the claims the code relies on:
[`infra/cognito/README.md`](../infra/cognito/README.md). Cognito has no dynamic client
registration, so clients use one of the pre-registered client IDs (simulator, MCP Inspector, CLI).

The email address is used for exactly one thing — the destination of `overturn_send_letter` —
and is never returned by a tool, never logged, and never accepted as a parameter.

## Tools

Eleven tools, named `overturn_*`. Descriptions are written for an orchestrating assistant: they
say *when* to call. Every result is the same envelope (`structuredContent` + a text block):

```
{ ok: true,  case: { code, status }, data: {...}, speak: "≤ 60 words the assistant may say verbatim" }
{ ok: false, error: { code, message, speak } }
{ ok: false, needs_confirmation: { action, question, expectedYes: [...], expectedNo: [...] } }
```

`speak` strings are templates over the rules dataset, so deadlines, protections and their sources
never pass through the model's paraphrase.

| Tool | When the assistant calls it | Consequential |
|---|---|---|
| `overturn_start_case` | First, as soon as the user mentions a denied claim / prior auth / surprise bill. Returns the opening line and the case code. | |
| `overturn_attach_document` | When the client has the user's document (companion upload). Long call with progress. | |
| `overturn_use_sample` | User wants to try with a sample, or a demo. | |
| `overturn_answer` | One spoken answer at a time; server maps free words to values and returns the next question (≤ 4 options). | |
| `overturn_get_readback` | "Repeat" / "say that again". | |
| `overturn_confirm_facts` | After the read-back question: yes moves on, no lists the fields to correct. | |
| `overturn_compute_rights` | Once facts are confirmed. Deterministic. Returns the first deadline (date + days) and up to three protections with source names, in ≤ 120-word chunks. | |
| `overturn_draft_letter` | Only after the user said yes to a letter. | **yes** |
| `overturn_send_letter` | Only after the user said yes to the send question naming the masked email. No recipient parameter. Falls back to a download link. | **yes** |
| `overturn_discard_case` | "Stop", "cancel", "never mind". | **yes** (destructive) |
| `overturn_get_help` | "Should I appeal?", "Will I win?", distress, "a human". Returns free help for the state and the one-sentence deflection. | |

Consequential tools called without `confirmed: true` do nothing and return `needs_confirmation`
with the exact question to ask. The state machine (`src/machine.ts`) also refuses calls out of
order (`wrong_state`), from another session (`wrong_session`), or after expiry (`case_not_found`).

Resources: `overturn://samples`, `overturn://rules/{jurisdiction}`. Prompt: `overturn_voice_persona`
(the recommended system prompt for a voice assistant; the simulator loads it over MCP).

Full contract: [`specs/002-alexa-voice-mcp/contracts/mcp-tools.md`](../specs/002-alexa-voice-mcp/contracts/mcp-tools.md).

## Case lifecycle and privacy

A case lives in server memory, owned by the MCP session that created it, and is deleted on send,
on discard, or after `MCP_CASE_TTL_MINUTES` (30) of inactivity. Its 6-character code
(alphabet `ACFHJKMNQRWXY234679`, no look-alike or sound-alike pairs) is blocked from reuse for
`MCP_CODE_TOMBSTONE_HOURS` (24). Nothing is written to disk or a database. Logs never contain
document text, extracted facts, letter text or email addresses (`src/log.ts`).

Statuses: `started → awaiting_document | answering → facts_pending → facts_confirmed → rights_computed → letter_drafted → sent`, plus `discarded`.

## Try it with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Transport **Streamable HTTP**, URL `http://localhost:8000/mcp`, Authentication header
`Authorization: Bearer <token>` (dev token, or `infra/cognito/token.sh`), Connect. Then:

1. `overturn_start_case` → note the `code`.
2. `overturn_use_sample` with `{ "code": "…", "sample_id": "02-prior-auth-ca" }` → read-back.
3. `overturn_confirm_facts` `{ "code", "answer": "yes" }` → next question ids; answer them with `overturn_answer`.
4. `overturn_compute_rights` → deadline and protections, each with `sourceUrl` and `lastVerified`.
5. `overturn_draft_letter` **without** `confirmed` → `needs_confirmation`; again with `"confirmed": true`.
6. Remove the bearer and call anything → `401`.

Screenshots: `docs/screenshots/mcp-inspector-{tools,needs-confirmation,401}.png` ⟦T016⟧.

## Conformance test

```bash
pnpm test:mcp                                   # spawns the server, dev auth, model calls mocked
OVERTURN_MCP_URL=https://… BEARER=… pnpm test:mcp:remote   # against the deployment
```

Asserts: protocol `2025-11-25` negotiated; 11 tools with annotations; `401` + protected-resource
metadata; a complete sample case including the `needs_confirmation` round-trip; every deadline
and protection carries `sourceUrl` and `lastVerified`; `wrong_state`, `wrong_session`, expiry;
p95 of non-model calls < 500 ms (the Alexa+ latency requirement).

## Deploy

Container (`mcp/Dockerfile`, `node:22` on `linux/arm64`, port 8000, path `/mcp`) → Amazon ECR →
**Bedrock AgentCore Runtime** with protocol MCP and a `CUSTOM_JWT` authorizer on the Cognito
discovery URL. AgentCore adds and propagates `Mcp-Session-Id`, so a client stays on one runtime
session and the in-memory case store holds. Fallback: the same image on AWS App Runner.
Steps, IAM and cost notes: [`infra/README.md`](../infra/README.md) ⟦T028⟧.

## When Alexa+ access opens

Everything below is configuration; no server code changes. From the Alexa+ MCP QuickStart:

1. `npm i -g` the Alexa AI CLI, `alexa-ai configure` (Login with Amazon with the developer account).
2. `alexa-ai new mcp --name "Overturn" --locale en-US --mcp-server-url "<public /mcp URL>"`
   — the CLI introspects the tools and scaffolds `addon.json`.
3. In `addon.json`: `distributionCountries: ["US"]`; short and long descriptions (use the
   "What it does" text from the README); privacy policy URL (`/about` on the web app) and terms;
   the example utterances from `specs/002-alexa-voice-mcp/voice-design.md` §4; icon and media
   from `docs/`.
4. Account linking: authorization URL `COGNITO_DOMAIN/oauth2/authorize`, token URL
   `COGNITO_DOMAIN/oauth2/token`, scopes `openid email profile`, PKCE S256, a new public client
   in the user pool whose callback is the Alexa redirect URL the CLI prints — add its client ID to
   `COGNITO_CLIENT_IDS` (and to the AgentCore authorizer's allowed clients) and restart.
5. `alexa-ai deploy` → Add-on ID → test in the web simulator, then on a device.
6. Re-run the conformance test against the same URL; check p95 < 500 ms from the simulator's region.
7. `alexa-ai submit`.

Things to verify on a real device that the simulator cannot: barge-in during the rights
read-out, behaviour on a 10-second silence, how the companion code sounds through the device's
TTS, and whether Alexa+ passes the `needs_confirmation` question verbatim.

## Layout

```
mcp/
├── src/
│   ├── index.ts        entry: env, port 8000, start
│   ├── server.ts       Hono app, Streamable HTTP transport, metadata, /healthz
│   ├── auth.ts         Cognito JWT / dev bearer, 401, userInfo
│   ├── store.ts        in-memory cases, TTL, tombstones, session ownership
│   ├── machine.ts      statuses, transitions, confirmation gate
│   ├── tools/          one file per tool + index.ts
│   ├── resources.ts    samples, rules
│   ├── prompts.ts      overturn_voice_persona
│   └── log.ts          scrubbed logger
├── Dockerfile
├── package.json        name: overturn-mcp-server
└── README.md
```

Shared engine: `../lib/` (unchanged from feature 001), speech templates `../lib/voice/`,
delivery `../lib/delivery/`.

## Environment

See [`.env.example`](../.env.example), sections *MCP server*, *Cognito*, *AWS*, *Language model*.
