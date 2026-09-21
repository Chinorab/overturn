# Quickstart & validation — 002 Alexa+ Voice Appeal Assistant

Target: a fresh machine gets a local MCP server + simulator running in < 15 minutes (SC-008).

## Prerequisites

- Node 22, pnpm 9; an LLM key (`ANTHROPIC_API_KEY` **or** `NEBIUS_API_KEY`).
- For auth: a Cognito user pool (script `infra/cognito/setup.sh` creates pool, public PKCE
  client, hosted domain; prints the env values). For a no-AWS smoke run: `MCP_AUTH_MODE=dev`
  accepts a static dev bearer from `.env.local` and still returns 401 without it.
- For email: SES verified sender (`SES_FROM`) and, in sandbox, a verified recipient. Without
  AWS credentials the send falls back to the download link (that path is part of the demo).

## Run

```bash
pnpm install
cp .env.example .env.local   # fill keys; see the table in specs/002-alexa-voice-mcp/contracts/simulator-api.md
pnpm mcp:dev                 # MCP server on http://localhost:8000/mcp  (Hono, --conditions=react-server)
pnpm dev                     # Next app: /sim, /companion  (http://localhost:3000)
```

## Validate

| # | Check | Command / action | Expected |
|---|---|---|---|
| 1 | Protocol & auth conformance | `pnpm test:mcp` | initialize → `2025-11-25`; 11 tools; 401 without bearer; full sample case; every rule has `sourceUrl` + `lastVerified`; p95 non-model call < 500 ms |
| 2 | Inspector walk-through (judge path) | `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:8000/mcp` + bearer | Tools listed with descriptions; `overturn_draft_letter` without `confirmed` returns `needs_confirmation` |
| 3 | Voice happy path | open `/sim`, link account, say the T1–T12 script from `voice-design.md` with sample 02 via `/companion` | ≤ 12 assistant turns, one question each, email received with PDF + summary (or download link if SES unset) |
| 4 | No-document path | `/sim`, "No, I can't find it" → TX / employer / prior auth / two weeks ago / no | Approximate deadline spoken; letter with `[ADD: …]` blanks emailed |
| 5 | Turn-shape guard | `pnpm test -- turns` | Checker flags 2-question and 61-word fixtures; passes golden transcripts |
| 6 | Provider switch | `OVERTURN_LLM_PROVIDER=nebius pnpm test:providers` | Required fields match golden on the six text samples ≥ 90 % |
| 7 | Privacy | `pnpm test -- privacy` and `git grep -nE "(sk-ant|AKIA|nebius_[a-z0-9]{8})"` | Logs contain no document text/email; grep empty |
| 8 | Dataset sync | `pnpm test -- rules-version` | Vendored `data/rules/*` equals tagged release in `us-health-appeal-rules` |
| 9 | Deployed | `OVERTURN_MCP_URL=https://… pnpm test:mcp:remote` | Same as #1 against AgentCore URL with a Cognito token |
| 10 | Docs | read `README.md` "Built during the hackathon", `FEEDBACK.md`, `FRICTION_LOG.md` | Sections present, dated entries |

## Deploy (summary; full steps in `infra/README.md`)

1. `infra/cognito/setup.sh` → pool, client, domain → env values.
2. `docker buildx build --platform linux/arm64 -t overturn-mcp -f mcp/Dockerfile .` → push to ECR.
3. `agentcore` CLI (or `aws bedrock-agentcore-control create-agent-runtime`) with protocol MCP,
   `CUSTOM_JWT` authorizer = Cognito discovery URL + client IDs, env vars from `.env.example`.
4. Simulator on Vercel (existing project) with `OVERTURN_MCP_URL` = AgentCore invocation URL.
5. Fallback: `infra/apprunner/` runs the same image if AgentCore blocks.
