# Tasks: Alexa+ Voice Appeal Assistant (MCP)

**Input**: Design documents from `specs/002-alexa-voice-mcp/` (plan, spec, research, data-model, contracts/, voice-design, quickstart)

**Tests**: Included where the spec makes them acceptance criteria (SC-004/005/007/009/010) — conformance, turn-check, golden transcripts, provider parity, rules-version. No TDD ceremony elsewhere.

**Organization**: Phases follow the plan's milestones. US3 (MCP server) comes before US1 (simulator) because the simulator is a client of the server; both are P1.

**Working rules (every task)**: commit per task on `002-alexa-voice-mcp`; friction → `FRICTION_LOG.md` the same hour; first use of a tool/SDK → stub in `FEEDBACK.md`; update `PROGRESS.md` at end of day. Everything in English. No key in source (`pnpm test -- privacy` stays green).

## Format: `[ID] [P?] [Story] Description` · **[P]** = parallelizable · dates = plan schedule

---

## Phase 1: Setup — M0 (Sep 28)

- [x] T001 Amend constitution to v1.1 in `.specify/memory/constitution.md`: hackathon-2 context, second LLM provider behind one interface, AWS runtime for the MCP server next to Vercel, code freeze 2026-10-20 20:00 Paris, 21–22 Oct reserved; dated amendment note - *done 2026-09-21 (pre-window; documentation, not code)*
- [ ] T002 Convert repo to a pnpm workspace: `pnpm-workspace.yaml` (root + `mcp/`), create `mcp/package.json` (name `overturn-mcp-server`, deps `@modelcontextprotocol/sdk@^1.30`, `hono`, `@hono/node-server`, `jose`, `zod`), `mcp/tsconfig.json` with path alias `@/lib/*` → `../lib/*`, root scripts `mcp:dev`, `mcp:build` (esbuild bundle → `mcp/dist/index.js`, packages external, `@/lib` alias), `test:mcp`; `mcp/package.json` must list every runtime dep the bundle imports (see `mcp/Dockerfile` header)
- [ ] T003 [P] Create `mcp/src/index.ts` + `mcp/src/server.ts`: Hono app, `GET /healthz`, MCP endpoint `/mcp` via `WebStandardStreamableHTTPServerTransport` (stateful, session id generator), port 8000; prove `import "server-only"` from `lib/` works with `node --conditions=react-server` (document the fix in `mcp/README.md`)
- [x] T004 [P] Scaffold `FEEDBACK.md` (one section per tool: MCP TS SDK, Hono, Cognito, AgentCore, SES, Polly, Web Speech API, Anthropic, Nebius, Inspector, agentcore CLI, Devpost) with the five headings usage / works / friction / onboarding / would reuse; add `.env.example` entries from `contracts/simulator-api.md` - *done 2026-09-21 (documentation)*
- [ ] T005 [P] Day-1 spikes, results logged in `FRICTION_LOG.md` + `FEEDBACK.md`: (a) `agentcore add agent --language TypeScript` supported? else note `create-agent-runtime` path; (b) Cognito user pool + public PKCE client + managed login, run one PKCE flow with a local callback; (c) SES sandbox state, verify sender + demo recipient, request production access. Script the Cognito part into `infra/cognito/setup.sh`

**Checkpoint M0**: `pnpm mcp:dev` serves `/healthz` and an empty `tools/list`; spikes answered.

---

## Phase 2: Foundational — M0/M1 (Sep 29–30)

- [ ] T006 Provider seam: create `lib/ai/provider.ts` (interface `LLMProvider { structured<T>(...); chatWithTools(...) }`, `getProvider()` from `OVERTURN_LLM_PROVIDER`, default `anthropic`), move current client into `lib/ai/providers/anthropic.ts`, add `lib/ai/providers/fake.ts` (golden sample JSON, for tests), switch `lib/ai/extract.ts`, `explain.ts`, `draft.ts` to the provider; existing `pnpm test` must stay green (behaviour unchanged)
- [ ] T007 [P] Pure voice utilities — **code and 66 test cases drafted and run; see `contracts/case-code-and-answers.md`** — in `lib/voice/case-code.ts` (alphabet `ACFHJKMNQRWXY234679`, generate, `spoken()` in two groups of three, NATO form), `lib/voice/answers.ts` (utterance → `USStateCode | PlanSource | YesNoUnknown | DenialCategory`, relative dates "two weeks ago" → ISO, yes/no grammar from voice-design §7), with unit tests in `tests/voice/case-code.test.ts`, `tests/voice/answers.test.ts`
- [ ] T008 [P] Templated speech — **code drafted, run against the engine and the golden samples, outputs now verbatim in the golden transcripts; see `contracts/speech-templates.md`** — in `lib/voice/spoken.ts` (formats), `lib/voice/readback.ts` (≤ 40-word document read-back from `Extraction`, single-field re-read) and `lib/voice/rights-speech.ts` (`SpokenRightsSummary` from `RightsResult`: first deadline as date + days + source name, protections ≤ 2 sentences each with source name, ≤ 120-word chunks, approximate flag); unit tests asserting word limits and that every chunk names a source (`tests/voice/speech.test.ts`)
- [ ] T009 In-memory case store and state machine — **code and 35+ assertions drafted and run; see `contracts/store-and-machine.md`** — in `mcp/src/store.ts` (Map, 30-min idle TTL with injectable clock via `OVERTURN_CLOCK` + test-only `POST /__test/clock`, 24-h code tombstones, session ownership) and `mcp/src/machine.ts` (statuses and transitions from data-model.md, `requireStatus`, confirmation gate returning `needs_confirmation` with the exact question); unit tests `tests/mcp/machine.test.ts`
- [ ] T010 Auth — **code and 34 assertions drafted and run against a local RSA JWKS; see `contracts/auth-and-logging.md`** — in `mcp/src/auth.ts`: Cognito JWT verification with `jose` + JWKS (`COGNITO_ISSUER`, `COGNITO_CLIENT_ID`s), `401` + `WWW-Authenticate: Bearer resource_metadata=…`, `GET /.well-known/oauth-protected-resource` (RFC 9728) pointing at the issuer, `MCP_AUTH_MODE=dev` static bearer for local runs; `userInfo` fetch → `{ email, emailMasked }` cached per session; log scrubber (no emails, no document text) in `mcp/src/log.ts`

**Checkpoint**: foundation ready — engine callable through the provider, speech templates tested, store/auth ready to host tools.

---

## Phase 3: User Story 3 — A judge connects any MCP client (P1) — M1 (Oct 1–3)

**Goal**: 11 tools, 2 resources, 1 prompt, conformance test green, Inspector walkthrough possible.

**Independent Test**: `pnpm test:mcp` (spawned server, SDK client over Streamable HTTP) passes all six checks in `contracts/mcp-tools.md`.

- [ ] T011 [P] [US3] Tools — **handlers, envelope and 46 assertions drafted and run; see `contracts/tools-basic.md`** — `overturn_start_case`, `overturn_use_sample`, `overturn_get_readback`, `overturn_confirm_facts`, `overturn_get_help` in `mcp/src/tools/{start,sample,readback,confirm,help}.ts` — zod in/out schemas, annotations, descriptions verbatim from the contract, `speak` from templates, `structuredContent` + text block; register in `mcp/src/tools/index.ts`
- [ ] T012 [P] [US3] Tools — **handlers and 47 assertions drafted and run; see `contracts/tools-input.md`** — `overturn_attach_document` (calls `extractDocument`; progress notifications; maps `ExtractionInvalidError`/unsupported program → error envelope) and `overturn_answer` (uses `lib/voice/answers.ts`, returns `next` question id and ≤ 4 options, `not_understood` with re-listed options, `correction` mode) in `mcp/src/tools/{attach,answer}.ts`
- [ ] T013 [US3] Tools — **`compute_rights` and `draft_letter` handlers with 36 assertions drafted and run; see `contracts/tools-rights.md`; `send_letter`/`discard_case` land with T020** — `overturn_compute_rights` (buildSituation → computeRights → `rights-speech`), `overturn_draft_letter` (gate → `draftLetter`; letter meta: pages, blanks, checklist, where-to-send), `overturn_send_letter` (gate → `lib/delivery/email.ts` stub returning `delivery_failed` until T020 → download token), `overturn_discard_case` in `mcp/src/tools/{rights,draft,send,discard}.ts`
- [ ] T014 [P] [US3] Resources `overturn://samples`, `overturn://rules/{jurisdiction}` in `mcp/src/resources.ts` and prompt `overturn_voice_persona` in `mcp/src/prompts.ts`, loading the text from `mcp/prompts/overturn_voice_persona.md` (written 2026-09-21; test it against the golden transcripts in T027 and tighten)
- [ ] T015 [US3] Conformance test `tests/mcp/conformance.test.ts` — **full code drafted in `contracts/conformance-test.md`; copy, run, fix** (needs the fake provider, injectable clock, SES mock listed there): protocol `2025-11-25`, 11 tools with annotations, 401 + PRM metadata, full sample-02 case with `needs_confirmation` then `confirmed`, every deadline/protection carries `sourceUrl` + `lastVerified`, `wrong_state`/`wrong_session`/expiry, p95 < 500 ms for non-model calls (model calls mocked via provider fake)
- [ ] T016 [US3] Inspector walkthrough: run `npx @modelcontextprotocol/inspector` against local server with dev bearer, capture 3 screenshots into `docs/screenshots/mcp-inspector-*.png`, finalize `mcp/README.md` (draft ready; fill the ⟦T016⟧/⟦T028⟧ screenshot and infra placeholders)

**Checkpoint M1**: server complete; a judge can run a case from Inspector.

---

## Phase 4: User Story 1 — Appeal by voice with the letter in hand (P1) 🎯 MVP — M2 (Oct 4–8)

**Goal**: `/sim` voice console + `/companion` upload drive the server end to end; happy path T1–T12 with sample 02 ends in an email (or download link).

**Independent Test**: quickstart check #3 — ≤ 12 assistant turns, one question each, email with PDF + summary received.

- [ ] T017 [US1] Account linking: `lib/sim/cognito.ts` (PKCE authorize URL, token exchange, refresh), `app/sim/link/page.tsx` + `app/sim/link/callback/route.ts`, in-memory session store `lib/sim/session.ts` keyed by httpOnly cookie (tokens never in the cookie); shows masked email once linked
- [ ] T018 [US1] Orchestrator `lib/sim/orchestrator.ts`: MCP `Client` + `StreamableHTTPClientTransport` with the user's bearer, loads `overturn_voice_persona` prompt and `tools/list`, provider `chatWithTools` loop (≤ 4 tool rounds), `needs_confirmation` short-circuit (question verbatim), emits SSE events `assistant_text | tool_call | tool_result | violation | done`; route `app/api/sim/turn/route.ts`, `app/api/sim/reset/route.ts`
- [ ] T019 [P] [US1] Turn-shape checker `lib/voice/turn-check.ts` — **code and tests drafted and replayed against the five transcripts (0 violations) in `contracts/turn-check.md`; copy and run**: (one question, ≤ 60 words / ≤ 120 for rights chunk, banned phrases from `lib/ai/guard.ts`; regenerate-once-then-truncate policy applied in the orchestrator) with fixtures in `tests/voice/turn-check.test.ts`
- [ ] T020 [P] [US1] Delivery (copy, layout, data mapping and tests specified in `docs/delivery-templates.md`): `lib/delivery/summary-pdf.tsx` (one-page summary: deadlines with anchors, protections with links, checklist, where to send, human help, information-not-advice footer) and `lib/delivery/email.ts` (SES v2 `SendEmail`, Simple content + Attachments: letter PDF + summary PDF, recipient = session email only, returns `messageId` or throws `delivery_failed`); wire into `overturn_send_letter` with download-token fallback served by `app/companion/download/[token]/route.ts`
- [ ] T021 [US1] Voice console `app/sim/page.tsx` + `components/sim/{MicButton,Transcript,SimBanner,CompanionCard}.tsx`: Web Speech STT (en-US, interim greyed, wake-word strip, mic auto-reopen, barge-in), typed input always visible, "Alexa+ simulation (unofficial)" banner, QR/link to `/companion?code=`, latency cover ("One moment.") after 2.5 s; follows 001 design tokens and WCAG 2.2 AA
- [ ] T022 [P] [US1] TTS route `app/api/sim/tts/route.ts` (Polly neural, SSML breaks, per-session cache, 503 → client falls back to `speechSynthesis`); `POLLY_VOICE` env
- [ ] T023 [US1] Companion page `app/companion/page.tsx` + `app/api/companion/{upload,status}/route.ts`: code entry, file (PDF/JPG/PNG ≤ 10 MB) or sample picker, calls `overturn_attach_document` / `overturn_use_sample` on the MCP session owning the code (lookup in `lib/sim/session.ts`), status polling "Reading… / Done — go back to voice"; no-code landing explains where the code comes from
- [ ] T024 [US1] Playwright `tests/e2e/sim.spec.ts`: typed-input happy path with sample 02 through `/companion`, speech APIs stubbed, asserts turn count ≤ 12, one question per turn, final turn contains "Sent" or a download link; record the golden transcript `docs/transcripts/us1-sample02.md`

**Checkpoint M2 (MVP)**: the video's core flow works locally end to end.

---

## Phase 5: User Story 2 — Appeal by voice without the document (P2) — M3 (Oct 9–10)

**Goal**: five spoken answers → approximate deadline, protections, letter with blanks; recovery table implemented.

**Independent Test**: quickstart check #4; rules match golden (TX, employer, prior-auth, non-urgent).

- [ ] T025 [US2] No-document path: `overturn_start_case(has_document:"no")` → `answering` status; `overturn_answer` question sequence `state → plan_source → denial_category → document_date → urgent`, synthetic `Extraction` builder `lib/voice/no-document.ts` (category + approx date + `[ADD]` placeholders), `approximate` flag propagated to `rights-speech` and to the letter draft; Medicare/Medicaid answer → `unsupported_coverage` stop with official channel
- [ ] T026 [US2] Recovery behaviours from voice-design §6 in `mcp/src/tools/*` and orchestrator: progressive re-prompts (1st short, 2nd options, 3rd skip/help), upload check-ins (two, then offer no-document), document/state discrepancy question, model-down message routing to the no-document offer, silence re-prompt in `components/sim/MicButton.tsx`
- [ ] T027 [US2] Golden transcripts (SC-005) in `docs/transcripts/` — **five target transcripts already written 2026-09-21 with a findings list in `docs/transcripts/README.md`; re-run them through the real orchestrator and reconcile**: US1 sample 01 with a correction, US2 TX, unsupported Medicare (sample 06), cancel mid-way; each run through the orchestrator, reviewed by hand, violations = 0; add `tests/voice/golden.test.ts` that replays them through `turn-check`

**Checkpoint M3**: robust demo path exists even with the model down.

---

## Phase 6: User Story 5 — Deployed and documented (P2) — M4 (Oct 11–13)

**Goal**: public MCP URL on AgentCore Runtime with Cognito authorizer; simulator on Vercel points at it; remote conformance green.

**Independent Test**: quickstart check #9 against the public URL; README path < 15 min on a clean clone.

- [ ] T028 [US5] Container: `mcp/Dockerfile` + `.dockerignore` (drafted 2026-09-21: multi-stage, pnpm deploy, non-root, healthcheck, `NODE_OPTIONS=--conditions=react-server`; requires `mcp:build` = esbuild bundle and a complete `mcp/package.json` dependency list — see the header comment), `infra/agentcore/README.md` + config (protocol MCP, `CUSTOM_JWT` authorizer = Cognito discovery URL + allowed client IDs, env vars), push to ECR, deploy via `agentcore` CLI or `aws bedrock-agentcore-control create-agent-runtime`; `infra/apprunner/` fallback documented and tried only if AgentCore fails
- [ ] T029 [US5] Remote conformance `pnpm test:mcp:remote` (`OVERTURN_MCP_URL`, real Cognito token via `infra/cognito/token.sh`); simulator env on Vercel (`OVERTURN_MCP_URL`, Cognito, Polly, SES creds as project env vars); verify the `/sim` → AgentCore → SES loop from the deployed simulator; friction log for every AWS step
- [ ] T030 [P] [US5] `infra/README.md` (draft ready: architecture, step-by-step deploy, env by component, security, cost, teardown — fill the ⟦T028⟧ placeholders and confirm the CLI flags actually used); `.env.example` complete; `pnpm test -- privacy` extended to scan `mcp/` and `infra/` for key patterns

**Checkpoint M4**: judges can hit the public server; AWS Builder story is real.

---

## Phase 7: User Story 4 — Reuse the rules dataset (P2) — M5 (Oct 14–15)

**Goal**: `Chinorab/us-health-appeal-rules` published under MIT; Overturn vendors it with a version pin.

**Independent Test**: quickstart check #8; dataset repo `node validate.mjs` passes on shipped data and fails on a broken fixture.

- [ ] T031 [US4] Create the public repo (gh CLI) with `LICENSE` (MIT), `README.md` (draft ready in `docs/dataset-repo/README.md`), `schema.json` generated from `lib/rules/schema.ts` via `scripts/export-rules-schema.ts`, `rules/{federal,nsa,ca,ny,tx}.json`, `validate.mjs` (draft ready and tested in `docs/dataset-repo/validate.mjs`; **trim `tx.iro.eligibility` summary to ≤ 60 words** — it is 64 and the validator rejects it), `CHANGELOG.md` + `VERSION` + `LICENSE` (drafts ready in `docs/dataset-repo/`, fill the ⟦dates⟧), `docs/adding-a-state.md` (draft ready in `docs/dataset-repo/docs/adding-a-state.md`), tag `v1.0.0`
- [ ] T032 [US4] Vendor back: `data/rules/RULES_VERSION`, `scripts/sync-rules.ts` (fetch tag, diff), `tests/rules/version.test.ts` failing on drift (SC-009); Overturn README gets an "Open Source mini-challenge" section linking the dataset

**Checkpoint M5**: Open Source deliverable done.

---

## Phase 8: Polish & cross-cutting — M6/M7 (Oct 16–20)

- [ ] T033 Nebius provider `lib/ai/providers/nebius.ts` (OpenAI-compatible client on `NEBIUS_BASE_URL`, `response_format: json_schema`, models `NEBIUS_MODEL_EXTRACT`/`NEBIUS_MODEL_WRITE` defaulting to Nano-30B / Super-120B, PDF → text via `pdfjs-dist`, images → `unsupported_on_provider` unless `NEBIUS_VISION_MODEL`), tool-calling for `chatWithTools`; parity test `tests/providers/parity.test.ts` on the six text samples (≥ 90 % required fields, SC-010), `pnpm test:providers`
- [ ] T034 [P] Accessibility + design pass on `/sim`, `/sim/link`, `/companion` (axe via Playwright, keyboard-only run, 375-px layout, focus order after TTS, reduced-motion) — reuse 001 components and tokens; fix findings
- [ ] T035 [P] README (all sections drafted in `docs/readme-alexa-sections.md` with a merge plan; fill ⟦…⟧ and merge): "Built during the hackathon" section (before 2026-09-28: feature 001 — `app/`, `lib/ai`, `lib/rules`, `data/`; during: `mcp/`, `lib/voice`, `lib/sim`, `lib/delivery`, `app/sim`, `app/companion`, `infra/`, dataset repo), Alexa+ section (simulated path + why, QuickStart-conformance table, "when access opens"), provider table, run/deploy links to quickstart; `LEGAL_DESIGN.md` addendum on voice and email delivery (written 2026-09-21; re-read against the shipped behaviour)
- [ ] T036 [P] Complete `FEEDBACK.md` per tool (usage, works, friction, onboarding, reuse) and review `FRICTION_LOG.md` (each entry has task/steps/expected vs actual/severity/workaround/suggestion; at least one entry per week); cross-check FEEDBACK covers every tool listed in README
- [ ] T037 Clean-clone rehearsal of `quickstart.md` on a second machine or fresh directory, timed (< 15 min, SC-008); fix gaps; run all checks #1–#10; **code freeze 2026-10-20 20:00 Paris**; stretch only if everything green: real-Echo bridge spike noted in `docs/stretch-echo-bridge.md`

---

## Phase 9: Submission — Oct 21–23 (not code)

- [ ] T038 Video (< 3 min, English): script from voice-design §9 (first 30 s = T1→T3 with phone in frame, cut to T8), then no-document path 20 s, Inspector 20 s, inbox 15 s, architecture card 15 s, "built during the hackathon" card 10 s; record on Chrome with Polly audio; upload public YouTube; `docs/video-script-alexa.md` - *script written 2026-09-21; recording and edit remain for Oct 21-22*
- [ ] T039 Devpost page (draft ready in `docs/devpost-alexa.md`, fill the `⟦…⟧` placeholders): description, "Built during the hackathon", product feedback (from FEEDBACK.md), friction log attached, repo + dataset repo + video links, gallery from `docs/screenshots/`; final `pnpm test:mcp:remote` the morning of Oct 23; submit before **18:00 Paris** (deadline 21:00 Paris / 12:00 PDT)

---

## Dependencies & execution order

- Phase 1 → Phase 2 → **US3 (Phase 3)** → **US1 (Phase 4)** → US2 → US5 → US4 → Polish → Submission.
- US3 must precede US1 (the simulator is a client of the server). US2 depends on US3 tools and US1's orchestrator for recovery behaviours. US5 depends on US3 (container) and US1 (simulator env). US4 depends only on Phase 1 (can be pulled earlier if a day frees up). T033 (Nebius) depends on T006 only and can slide anywhere after M2 without risk.
- Cut order if time runs out (from last to first): T037 stretch → T033 Nebius (keep the interface, document as "second provider planned") → T034 depth → US4 (Open Source) → US5 fallback only (App Runner) → US2 recovery depth (T026). **Never cut**: US3, US1, T035/T036, T038/T039.

## Parallel opportunities (solo: interleave while waiting on AWS/LLM)

- Phase 1: T003 ‖ T004 ‖ T005. Phase 2: T007 ‖ T008 while T006 tests run.
- US3: T011 ‖ T012 ‖ T014, then T013 → T015 → T016.
- US1: T019 ‖ T020 ‖ T022 alongside T017/T018; T021 and T023 after T018.
- US5: T030 while AgentCore deploy propagates. Polish: T034 ‖ T035 ‖ T036.

## Implementation strategy

1. **MVP = Phases 1–4** (M0–M2, by Oct 8): server + simulator happy path. This alone is a submittable Alexa+ track entry.
2. Then robustness (US2), then the public deployment (US5, AWS Builder), then the dataset (US4, Open Source), then Nebius parity and polish.
3. Two buffer days are built in (Oct 20 freeze day; video days do not depend on new code).

## Format validation

All 39 tasks: checkbox · sequential ID · `[P]` only where files are disjoint · `[USn]` on story phases only · concrete file paths.
