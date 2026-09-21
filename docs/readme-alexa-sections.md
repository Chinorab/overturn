# README sections for the Alexa+ submission (merge at T035)

> Drafted 2026-09-21. Merge into `README.md` on 2026-10-18/19 once the build is real; `⟦…⟧`
> marks values to fill from the finished build. Merge plan at the end. Until then the public
> README describes the LexHack release, which is accurate.

---

## A. Header block (replaces the current title + LexHack line + demo links)

```markdown
# Overturn

**Understand and contest a health insurance denial — on a screen, or by voice.**
*"Alexa, my insurance denied my claim, help me appeal."* One question at a time, every fact
read back, deadlines and rights spoken with their sources, and the letter in your inbox —
nothing sent without your yes. Information, not legal advice.

**Build, Ship, Shape: Amazon Developer Hackathon (Oct 2026)** · Alexa+ track (self-hosted MCP
server, spec 2025-11-25, Streamable HTTP; simulated Alexa+ experience) · AWS Builder · Open Source

> **Voice demo (simulated Alexa+):** ⟦simulator URL⟧ · **MCP server:** ⟦AgentCore URL⟧ ·
> **Video (⟦m:ss⟧):** ⟦YouTube URL⟧ · **Open dataset:** https://github.com/Chinorab/us-health-appeal-rules
>
> **Web app (LexHack 2026, unchanged):** https://overturn-peach.vercel.app · video: https://youtu.be/7gX-vRLdb3s

Jump to: [Overturn on Alexa+](#overturn-on-alexa) · [Built during the hackathon](#built-during-the-hackathon) ·
[Run locally](#run-locally) · [Deploy](#deploy-on-aws)
```

---

## B. New section — insert after "The idea in one sentence"

```markdown
## Overturn on Alexa+

The people most likely to give up on an appeal are often the least comfortable with a form:
older adults, people who are sick and exhausted, people who talk to the speaker in their
kitchen before they open a browser tab. So the engine now answers a sentence.

**What you say → what happens**

| You say | The assistant does |
|---|---|
| "Alexa, my insurance denied my claim, help me appeal." | Says in two sentences that it gives information, not legal advice, and asks one question: do you have the letter? |
| "Yes." | Speaks a six-character code. You open the companion page on your phone, enter it, take a photo. |
| "It's in." | Reads the facts back in one breath — who denied what, when, why, for how much — and waits for your yes. "No" reopens one field. |
| your state, how you get coverage, was it an emergency, is it urgent | One question per turn. "I don't know" is accepted for everything but the state. |
| — | Speaks your first deadline as a date and a number of days, and up to three protections, each naming its source. "More" for the rest. |
| "Draft the letter." → "Yes." | Only then drafts it. |
| "Send it." → "Yes." (the question names your masked email) | Only then sends it, to the email on your linked account and nowhere else. |
| — | Tells you what to attach, where to send it, who to call for free help — and that it kept nothing. |

No letter? Five spoken answers give the federal and state baseline, an approximate deadline
and a letter with blanks — with no document reading at all, so it works even when the model
is down. "Repeat", "go back", "help", "stop" work at every turn; "should I appeal?" and "will
I win?" get one sentence and a human to call.

**How it is built**

- **`mcp/` — `overturn-mcp-server`.** TypeScript, `@modelcontextprotocol/sdk` 1.30
  (protocol **2025-11-25**), Hono, **Streamable HTTP**, stateful sessions. Eleven `overturn_*`
  tools whose descriptions say *when* to call them and whose results carry a ready-to-speak
  `speak` string generated from templates — deadlines, protections and sources never pass through
  the model's paraphrase. The consequential tools (draft, send, discard) refuse to act without
  `confirmed: true` and return the exact question to ask. Cases live in memory only.
- **Built to the Alexa+ MCP Toolkit requirements**: remote HTTPS URL, `401` +
  `WWW-Authenticate` on unauthenticated calls, OAuth 2.1 authorization code + PKCE (Amazon
  Cognito), sub-500 ms non-model calls. The Toolkit is available to select partners only during
  the hackathon, so this server has not been connected to a device; it is connectable by
  configuration — the checklist is in [`mcp/README.md`](mcp/README.md).
- **`app/sim` + `app/companion` — the simulated Alexa+.** A real MCP *client*: the orchestrator
  (Claude tool use behind the provider interface) gets the persona prompt and the tool list from
  the server over MCP. There is no private back-channel, so MCP Inspector or any other assistant
  gets the same experience. Web Speech API in, Amazon Polly out, typed input always available,
  labelled "Alexa+ simulation (unofficial)". A deterministic post-check enforces one question per
  turn and ≤ 60 words; violations are counted, not hidden.
- **Same engine, same rules.** Extraction, explanation, the deterministic rules engine and letter
  drafting are the LexHack code in `lib/`, unchanged in behaviour; the golden table that proves the
  engine's determinism is the same test.
- **AWS**: MCP server as an ARM64 container on **Bedrock AgentCore Runtime** with a `CUSTOM_JWT`
  authorizer on Cognito; **SES v2** sends the letter and a one-page summary as PDFs; **Polly** is
  the voice; **Cognito** managed login is the account linking. See [`infra/README.md`](infra/README.md).

**Try it** — three ways, from a judge's seat:

1. **Voice, 4 minutes:** open ⟦simulator URL⟧ in Chrome, *Link account* (sign up with any email;
   Cognito sends a code), allow the microphone, say the sentence above, then "yes", and on the
   companion page pick sample 02. Follow the transcript. ⟦SES sandbox note if still applicable⟧
2. **MCP directly:** `npx @modelcontextprotocol/inspector` → Streamable HTTP → ⟦MCP URL⟧ →
   bearer from `infra/cognito/token.sh`. List tools; call `overturn_draft_letter` without
   `confirmed` and read the refusal.
3. **Locally:** [`specs/002-alexa-voice-mcp/quickstart.md`](specs/002-alexa-voice-mcp/quickstart.md)
   — under 15 minutes on a clean clone.

Five golden transcripts — the happy path, a correction, the no-document path, a Medicare stop,
a cancel — are in [`docs/transcripts/`](docs/transcripts/); the conversation design they follow
is [`specs/002-alexa-voice-mcp/voice-design.md`](specs/002-alexa-voice-mcp/voice-design.md).
```

---

## C. New section — "Built during the hackathon" (insert before "What we deliberately did not build")

```markdown
## Built during the hackathon

Overturn existed before this hackathon: it was built solo in nine days for LexHack 2026 and
submitted on 2026-09-27. The Amazon submission window ran 2026-09-28 → 2026-10-23. This table is
the honest line between the two, at directory granularity; `git log --since=2026-09-28` on
branch `002-alexa-voice-mcp` is the receipt.

| Existed before 2026-09-28 (LexHack) | Built during the window (2026-09-28 → 2026-10-23) |
|---|---|
| `app/` — the four-screen web app, `/learn`, `/about`, API routes `/api/extract`, `/api/draft` | `mcp/` — the MCP server (tools, state machine, in-memory store, Cognito auth, persona prompt, Dockerfile) |
| `lib/ai/` — extraction, explanation, drafting, guard, prompts (called the Anthropic SDK directly) | `lib/ai/provider.ts`, `lib/ai/providers/` — provider interface; Anthropic adapter (moved code), **Nebius/Nemotron adapter (new)**; `extract/explain/draft.ts` now call the interface |
| `lib/rules/` — deterministic engine, schema, loader | `lib/voice/` — case codes, templated read-backs and rights speech, answer mapping, relative dates, turn checker |
| `lib/schemas/`, `lib/format.ts`, `lib/readability.ts`, `lib/session.tsx` | `lib/sim/` — orchestrator (MCP client + tool-use loop), Cognito PKCE, session store; `lib/delivery/` — SES email, summary PDF |
| `data/rules/*.json` (33 rules), `data/help-resources.json`, `data/glossary.json`, `data/samples/` | `app/sim/`, `app/companion/`, `app/api/sim/*`, `app/api/companion/*`, `components/sim/` — the simulated Alexa+ and the phone companion |
| `components/` (screens and UI kit), `public/` | `infra/` — Cognito scripts, AgentCore deployment, App Runner fallback |
| `tests/` — engine golden table, schema, guard, cached outputs, Playwright a11y | `tests/mcp/` (protocol conformance), `tests/voice/` (speech templates, turn check, golden transcripts), `tests/providers/` (parity), `tests/e2e/sim.spec.ts` |
| `README.md`, `LEGAL_DESIGN.md`, `specs/001-*`, `docs/api-spend.md`, `docs/video-script.md`, `docs/devpost.md` | `specs/002-alexa-voice-mcp/` (spec, plan, research, contracts, voice design, tasks), `LEGAL_DESIGN.md` addendum, `FEEDBACK.md`, `FRICTION_LOG.md`, `PROGRESS.md`, `docs/transcripts/`, `docs/video-script-alexa.md`, `docs/devpost-alexa.md`, `docs/dataset-repo/` |
| — | **Separate repository** [`us-health-appeal-rules`](https://github.com/Chinorab/us-health-appeal-rules) (MIT): the rules dataset with schema, validator, changelog and contribution guide; vendored back into `data/rules/` with a version pin and a drift test |
| Constitution 1.0.0 | Constitution 1.1.0 (voice action layer, memory-only cases, AWS runtime, provider interface) |

What did **not** change: the legal content of the rules (re-verified, dates updated), the
sample documents, the four web screens, the information-not-advice line.

Specification documents (spec, plan, tasks, this table's first draft) were written on
2026-09-21, before the window, and contain no code. The first code commit in the window is
⟦hash, date⟧.
```

---

## D. Replace the "Model" row in "Stack and credits" and add the AWS rows

```markdown
| Language models | Behind one interface (`OVERTURN_LLM_PROVIDER`): **Anthropic** [Claude Opus 5](https://www.anthropic.com) via `@anthropic-ai/sdk` (default; PDF and image input, structured outputs, tool use for the orchestrator) · **Nebius Token Factory** [NVIDIA Nemotron 3](https://build.nvidia.com) Nano 30B / Super 120B via the OpenAI-compatible API (text-only: PDFs read with `pdfjs-dist`). Server-side only. Parity on the text samples: ⟦n⟧ % required fields. |
| Assistant protocol | [Model Context Protocol](https://modelcontextprotocol.io) 2025-11-25, `@modelcontextprotocol/sdk` 1.30 — MIT · [Hono](https://hono.dev) — MIT · [jose](https://github.com/panva/jose) — MIT |
| AWS | [Bedrock AgentCore Runtime](https://aws.amazon.com/bedrock/agentcore/) (MCP hosting), [Cognito](https://aws.amazon.com/cognito/) (OAuth 2.1 PKCE), [SES](https://aws.amazon.com/ses/) v2 (email with attachments), [Polly](https://aws.amazon.com/polly/) (neural voice) — `@aws-sdk/*` v3, Apache-2.0 |
| Voice in | Web Speech API (Chrome/Edge); typed input everywhere as fallback |
| Target platform | [Alexa+](https://developer.amazon.com/alexaplus/) — MCP Toolkit requirements followed; simulated experience as the hackathon's sanctioned path while the Toolkit is partner-only |
```

Add to the "AI tools used to build" row: "…and for the conversation design, the voice
persona prompt and the golden transcripts, each reviewed by hand."

---

## E. "Run locally" — append

```markdown
### Voice assistant and MCP server

```bash
cp .env.example mcp/.env             # MCP + Cognito + LLM values (or MCP_AUTH_MODE=dev)
pnpm mcp:dev                         # MCP server on http://localhost:8000/mcp
pnpm dev                             # /sim (voice console), /companion (phone upload)
pnpm test:mcp                        # protocol conformance: 2025-11-25, 401, full sample case, sources on every rule
pnpm test -- voice                   # speech templates, turn checker, golden transcripts
OVERTURN_LLM_PROVIDER=nebius pnpm test:providers   # provider parity on the text samples
```

Full run and validation guide: [`specs/002-alexa-voice-mcp/quickstart.md`](specs/002-alexa-voice-mcp/quickstart.md).
Every variable, with comments: [`.env.example`](.env.example).

## Deploy on AWS

Cognito → SES → ECR image → AgentCore Runtime (`CUSTOM_JWT` on Cognito) → simulator on Vercel,
about 45 minutes; App Runner as the documented fallback. Step by step, IAM, cost and teardown:
[`infra/README.md`](infra/README.md).
```

---

## F. "Project documents" — add

```markdown
- [specs/002-alexa-voice-mcp/](specs/002-alexa-voice-mcp/) — Alexa+ feature: spec, plan, research, contracts (MCP tools, simulator), **voice conversation design**, tasks
- [mcp/README.md](mcp/README.md) — the MCP server: tools, auth, Inspector walkthrough, "when Alexa+ access opens"
- [infra/README.md](infra/README.md) — AWS architecture and deployment
- [docs/transcripts/](docs/transcripts/) — five golden conversations
- [FEEDBACK.md](FEEDBACK.md) — product feedback on every tool, SDK and service used
- [FRICTION_LOG.md](FRICTION_LOG.md) — every friction, logged when it happened
- [us-health-appeal-rules](https://github.com/Chinorab/us-health-appeal-rules) — the open rules dataset (MIT)
```

---

## G. "Privacy" — append one paragraph

```markdown
By voice, the same rules hold and one more: a case exists only in the MCP server's memory for
one conversation (discarded on send, on cancel, or after 30 minutes idle); the letter is emailed
only to the address of the account you linked, only after a confirmation that names it, and the
uploaded document is never emailed. The assistant never asks for an address, member ID or
Social Security number aloud. Details: [`LEGAL_DESIGN.md`](LEGAL_DESIGN.md#addendum-october-2026-the-same-line-spoken).
```

---

## Merge plan (T035, ~1 h)

1. Replace the header (A). Keep the LexHack tracks line as a second line of history, not the lead.
2. Insert B after "The idea in one sentence"; insert C before "What we deliberately did not build".
3. Update "Architecture" ASCII: add the MCP/AgentCore column from `infra/README.md` or link to it.
4. Apply D, E, F, G. Update "Quality, measured" with the new test counts and the Lighthouse score
   of `/sim` and `/companion` ⟦numbers⟧.
5. Fill every `⟦…⟧`; run a link check; read the whole README once aloud — it is the first thing
   the judges open.
