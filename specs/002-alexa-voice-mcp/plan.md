# Implementation Plan: Alexa+ Voice Appeal Assistant (MCP)

**Branch**: `002-alexa-voice-mcp` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-alexa-voice-mcp/spec.md`

## Summary

Expose the feature-001 engine (extract → explain → rules → draft) as `overturn-mcp-server`, a
TypeScript MCP server (spec 2025-11-25, Streamable HTTP, stateful sessions, Cognito OAuth 2.1
PKCE bearer auth) hosted on Bedrock AgentCore Runtime, and add a **simulated Alexa+** surface to
the existing Next.js app: a voice console (`/sim`) whose orchestrator is a real MCP client, a
phone companion page (`/companion`) for document capture by case code, Polly speech, and letter
delivery by SES with a download-link fallback. The LLM layer is abstracted behind
`OVERTURN_LLM_PROVIDER=anthropic|nebius`. The rules dataset moves to a separate MIT repository
and is vendored back. Design rationale in [research.md](research.md); dialogue script in
[voice-design.md](voice-design.md).

## Technical Context

**Language/Version**: TypeScript 5 / Node 22 (server, simulator, scripts) — one language, engine reused from `lib/`.

**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.30 (server + client), `hono`, `jose` (JWT/JWKS), `@aws-sdk/client-sesv2`, `@aws-sdk/client-polly`, `openai` (Nebius OpenAI-compatible adapter), `pdfjs-dist` (text for the Nebius path), existing `@anthropic-ai/sdk`, `zod` 4, Next 16, React 19.

**Storage**: none. In-memory `Map<CaseCode, Case>` with 30-min idle TTL and 24-h code tombstones; simulator sessions in memory keyed by httpOnly cookie. No DB, no disk.

**Testing**: Vitest (unit + MCP conformance via SDK client against a spawned server), Playwright (simulator typed path, companion upload), hand-reviewed golden transcripts.

**Target Platform**: MCP server → ARM64 container on Bedrock AgentCore Runtime (fallback App Runner), `us-east-1`; simulator → Vercel (existing project); auth → Cognito; email → SES; TTS → Polly.

**Project Type**: web application + standalone service in one repo (pnpm workspace: root Next app + `mcp/`).

**Performance Goals**: non-model tool calls < 500 ms p95 (Alexa+ requirement); document read ≤ 60 s with progress; first spoken token ≤ 2.5 s or canned cover; end-to-end US1 ≤ 4 min / 12 turns.

**Constraints**: no PHI at rest anywhere (memory only), no secrets in code, English only, information-not-advice at every turn, tool descriptions written for an orchestrator, works with any standards-compliant MCP client.

**Scale/Scope**: single-tenant demo; a few concurrent cases; 11 tools, 2 resources, 1 prompt; 4 new pages; ~25 tasks over 3.5 weeks solo.

## Constitution Check

*GATE: evaluated before Phase 0; re-evaluated after Phase 1 (below).*

| Principle | Status | Notes |
|---|---|---|
| I. Information, not advice | PASS | Opening line, `overturn_get_help` deflection, banned-phrase post-check, `speak` templates from rule summaries. Voice adds a *fourth* enforcement point: the state machine refuses consequential actions without an explicit yes. |
| II. US only, cited only | PASS | Same dataset; every spoken protection names its source, the email carries the link. Dataset moves to its own repo but is vendored and version-pinned (SC-009). |
| III. Built for a stressed non-expert | PASS (extended) | Voice is the accessibility extension of "one task per screen": one question per turn, ≤ 60 words, Grade-8 vocabulary, no dead ends. Companion page follows the 001 UI conventions. |
| IV. Privacy by construction | PASS with note | Memory-only cases; email only to the linked-account address; logs scrubbed. **Note**: the letter (PHI) transits SES to the user's own inbox — user-initiated, explicitly confirmed, not stored by us. Documented in LEGAL_DESIGN.md and the email footer. |
| V. Ship the narrow thing | PASS | Out-of-scope table in spec; real Echo bridge explicitly a stretch. |
| VI. Transparent provenance | PASS | README "Built during the hackathon" + FEEDBACK.md list every SDK/service. |
| Technical constraints — "the Claude API", "Vercel" | **DEVIATION (justified)** | 001 constitution names the Claude API and Vercel. This feature adds a second provider (Nebius) behind one interface and an AWS runtime for the MCP server. Both are hackathon requirements (provider freedom; AWS Builder). See Complexity Tracking; constitution to be amended to v1.1 (task T001). |
| Workflow — dates | **STALE** | Constitution's code-freeze dates are LexHack's. Amendment updates them to this window (freeze 2026-10-20 20:00 Paris; 21–22 Oct video/Devpost). |

**Post-Phase-1 re-check**: no new violations. The companion-upload-through-client shape (R4)
strengthens IV (the MCP server never exposes an unauthenticated upload endpoint).

## Project Structure

### Documentation (this feature)

```text
specs/002-alexa-voice-mcp/
├── plan.md              # this file
├── research.md          # R1–R11 decisions
├── data-model.md        # Case, Readback, ToolResult envelope, statuses
├── voice-design.md      # conversation design annex (script, recovery, formats)
├── quickstart.md        # run + validation guide
├── contracts/
│   ├── mcp-tools.md     # 11 tools, resources, prompt, conformance test
│   └── simulator-api.md # /sim, /companion routes, orchestrator + voice client contracts
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks output (next)
```

### Source Code (repository root)

```text
lib/                              # UNCHANGED engine (001) — shared
├── ai/
│   ├── provider.ts               # NEW: LLMProvider interface + selection by env
│   ├── providers/anthropic.ts    # NEW: moves current client.ts logic
│   ├── providers/nebius.ts       # NEW: OpenAI-compatible adapter + pdf text
│   └── extract.ts / explain.ts / draft.ts   # MODIFIED: call provider instead of anthropic()
├── voice/                        # NEW: pure functions shared by server & tests
│   ├── case-code.ts              # alphabet, generator, spoken form
│   ├── readback.ts               # templated ≤ 40-word read-backs
│   ├── rights-speech.ts          # SpokenRightsSummary + chunking
│   ├── answers.ts                # utterance → enum mapping, relative dates
│   └── turn-check.ts             # one-question / word-count / banned-phrase checker
└── delivery/
    ├── email.ts                  # NEW: SES v2 send with attachments
    └── summary-pdf.tsx           # NEW: one-page summary (react-pdf, as 001 letter)

mcp/                              # NEW workspace package: overturn-mcp-server
├── src/
│   ├── server.ts                 # Hono app, webStandard Streamable HTTP, /healthz, PRM metadata
│   ├── auth.ts                   # Cognito JWT verification, 401 + WWW-Authenticate, dev mode
│   ├── store.ts                  # in-memory cases, TTL, tombstones
│   ├── machine.ts                # status transitions + confirmation gate
│   ├── tools/*.ts                # one file per tool (schema + handler + description)
│   ├── resources.ts, prompts.ts  # samples/rules resources, voice persona prompt
│   └── index.ts                  # entry point (port 8000, path /mcp)
├── Dockerfile                    # node:22 arm64, --conditions=react-server
└── package.json

app/
├── sim/page.tsx, sim/link/…      # NEW: voice console, account linking
├── companion/page.tsx, companion/download/[token]/route.ts   # NEW
└── api/sim/{turn,reset,tts}/route.ts, api/companion/{upload,status}/route.ts   # NEW
components/sim/*                  # NEW: MicButton, Transcript, CompanionCard, SimBanner
lib/sim/                          # NEW: orchestrator (MCP client + LLM loop), session store, cognito pkce

infra/
├── cognito/setup.sh              # NEW
├── agentcore/                    # NEW: config + deploy notes
└── apprunner/                    # NEW: fallback
tests/
├── mcp/conformance.test.ts       # NEW
├── voice/*.test.ts               # NEW
└── e2e/sim.spec.ts               # NEW (Playwright)

data/rules/                       # vendored from Chinorab/us-health-appeal-rules + RULES_VERSION
FEEDBACK.md · FRICTION_LOG.md · README.md ("Built during the hackathon") · PROGRESS.md
```

**Structure Decision**: one repo, pnpm workspace with the Next app at the root (unchanged
deploy) and `mcp/` as a second package that imports `lib/` by relative path alias. The engine
stays in `lib/` untouched except for the provider seam; all voice logic that does not need HTTP
lives in `lib/voice/` so it is unit-testable and reusable by a future real-Alexa client.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Second LLM provider (Nebius) behind an interface | Same codebase serves the Nebius hackathon on 2026-10-30; hackathon rules leave provider free | Fork the repo per hackathon → two diverging engines, double bug-fixing in the same 3 weeks |
| Second deployment target (AWS) next to Vercel | Track requires a self-hosted MCP server; AWS Builder mini-challenge names AgentCore | Host MCP inside Vercel functions → no in-memory case continuity (would force PHI storage), 60-s limits break progress-reporting calls |
| Separate dataset repository | Open Source mini-challenge requires a *new* licensed project; reuse by others is the impact story | Keep in-repo with a LICENSE file → not "additional", not discoverable |

## Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AgentCore CLI does not scaffold TypeScript / container quirks | Lose 1–2 days | Verify D1 (2026-09-28); fallback `create-agent-runtime` from ECR image; App Runner as last resort — all documented, friction logged |
| Cognito PKCE from a Vercel-hosted simulator (callback URLs, CORS) | Blocks linking | Day-1 spike with local callback; dev bearer mode keeps everything else testable |
| Web Speech API unavailable (Firefox/Safari, mic permissions on video day) | Demo stalls | Typed input always present; record video on Chrome; Polly audio independent of STT |
| Orchestrator breaks turn rules | Design score | Deterministic post-check with regenerate-then-truncate; persona prompt served via MCP |
| SES sandbox on judging day | Email fails for judges | Request production access week 1; download-link fallback is a first-class path shown in the video |
| `server-only` import blocks standalone server | Day-1 blocker | Known fix (`--conditions=react-server`) already used by `precompute` |
| Nemotron JSON-schema adherence on long extraction | SC-010 misses | Nano for extraction with strict `json_schema`; retry once; measure on 6 text samples only |
| Time | Everything | Priorities are ordered; anything after M4 can be cut without breaking the video |

## Milestones & schedule (2026-09-28 → 2026-10-23, solo; Nebius work on the same repo after M5)

| Dates | Milestone | Done means |
|---|---|---|
| **Sep 28–29** | **M0 Foundations** | Constitution v1.1; workspace + `mcp/` skeleton serving `/mcp` with `tools/list`; `server-only` fix; provider interface with Anthropic adapter (behaviour identical, tests green); `FEEDBACK.md` scaffold; **D1 spikes**: AgentCore TS support, Cognito PKCE, SES sandbox status → friction log |
| **Sep 30–Oct 3** | **M1 MCP server complete (US3)** | Case store + state machine; 11 tools with `speak` templates; Cognito JWT auth + 401 + PRM metadata + dev mode; conformance test green locally; Inspector walkthrough recorded (screenshots) |
| **Oct 4–8** | **M2 Simulator (US1)** | `/sim` orchestrator over MCP client, typed input first, then Web Speech STT + Polly TTS; `/companion` upload by code; turn-check; happy path T1–T12 works end to end with sample 02; delivery via SES + download fallback |
| **Oct 9–10** | **M3 No-document path (US2) + recovery** | `overturn_answer` free-word mapping, relative dates, approximate deadlines; error table implemented; five golden transcripts reviewed (SC-005) |
| **Oct 11–13** | **M4 Deploy (US5)** | ECR image → AgentCore Runtime with Cognito authorizer; remote conformance test; simulator on Vercel pointed at it; `infra/README.md`; App Runner fallback documented |
| **Oct 14–15** | **M5 Open dataset (US4)** | `Chinorab/us-health-appeal-rules` published (MIT, schema, validate, changelog, add-a-state guide); vendored + version test |
| **Oct 16–17** | **M6 Nebius provider (SC-010)** | `nebius` adapter + pdf text; provider test on 6 samples; README provider table. *(Also the bridge to the Nebius submission.)* |
| **Oct 18–19** | **M7 Polish & docs** | Accessibility pass on `/sim` + `/companion`; README "Built during the hackathon", quickstart verified on a clean clone (SC-008); FEEDBACK.md complete per tool; friction log reviewed |
| **Oct 20** | **Code freeze 20:00 Paris** | Buffer day; stretch only if all green: real-Echo bridge spike |
| **Oct 21–22** | **Video + Devpost** | Script from voice-design §9; record (Chrome, phone in frame, Inspector, inbox); edit < 3 min; Devpost text, gallery, feedback + friction log attached |
| **Oct 23** | **Submit before 12:00 PDT (21:00 Paris)** | Submit by 18:00 Paris at the latest; final remote conformance run that morning |
| Oct 24–30 | Nebius submission | Provider default flipped by env for that demo; no code divergence |

Weekly rhythm: every evening update `PROGRESS.md`; every friction → `FRICTION_LOG.md` the same
hour; each tool/SDK first used → a `FEEDBACK.md` stub the same day.

## Next step

`/speckit-tasks` to break M0–M7 into ordered, testable tasks (target ≈ 25–30).
