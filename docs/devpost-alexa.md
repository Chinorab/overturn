# Devpost submission text — Overturn on Alexa+ (Build, Ship, Shape: Amazon Developer Hackathon)

> Draft written 2026-09-21, before the window. Paste into the Devpost form on 2026-10-22.
> `⟦…⟧` marks a value to fill from the finished build (numbers, URLs, frictions). Do not
> submit with a `⟦` left in the text. Everything else is final unless the build changes it.

**Project name:** Overturn — appeal a health insurance denial by voice

**Tagline:** "Alexa, my insurance denied my claim." One question at a time, every fact read back, deadlines and rights spoken with their sources, and the appeal letter in your inbox — nothing sent without your yes.

**Primary track:** Alexa+ (self-hosted MCP server, spec 2025-11-25, Streamable HTTP; simulated Alexa+ experience in a web app)

**Mini-challenges:** AWS Builder (Bedrock AgentCore Runtime, Cognito, SES, Polly) · Open Source (`us-health-appeal-rules`, MIT)

**Links:** Code: https://github.com/Chinorab/overturn · Open dataset: https://github.com/Chinorab/us-health-appeal-rules · Simulated Alexa+ demo: ⟦simulator URL⟧ · MCP server: ⟦AgentCore invocation URL⟧ · Video: ⟦YouTube URL⟧ · Web app (pre-existing): https://overturn-peach.vercel.app

---

## Inspiration

In 2024, insurers on HealthCare.gov denied 19 % of in-network claims. Fewer than 1 % were
appealed; a third of the appeals that were filed succeeded (KFF). People don't skip the appeal
because they agree with it. They skip it because the letter is unreadable, the rights are
unknown and the deadline is invisible.

I built Overturn for LexHack in September to fix that on a phone screen. Then I watched who
gives up first: older people, people who are sick and exhausted, people who will talk to the
speaker in their kitchen long before they open a browser tab and a form. For them the natural
first move is to *say what happened*. Alexa+ is where that sentence can land.

## What it does

You say: *"Alexa, my insurance denied my claim, help me appeal."* Then, one short turn at a time:

1. The assistant says what it is (information, not legal advice) and asks one question: do you have the letter?
2. If yes, it speaks a six-character code; you open the companion page on your phone, enter the code and take a photo. If not, it asks five spoken questions instead — state, how you get coverage, the reason given, roughly when the letter arrived, whether the care is urgent.
3. It **reads the facts back** in one breath — who denied what, when, why, for how much — and waits for your yes. Say "no" and it asks which item is wrong.
4. It tells you your **first deadline as a date and a number of days**, and the two or three protections that apply — the federal appeal rules, the No Surprises Act, your state's independent review — each with the name of its source.
5. It asks whether you want an appeal letter. Only on yes does it draft one. It asks whether to send it to the email on your linked account, naming the address. Only on yes does it send.
6. Your inbox gets the letter (PDF) and a one-page summary: deadlines with anchors, protections with links, what to attach, where to send, and the free Consumer Assistance Program for your state. The assistant keeps nothing.

Say "repeat", "go back", "I don't know", "help" or "stop" at any point. Ask "should I appeal?" or "will I win?" and it says, in one sentence, that it can't advise or predict — and offers a human who can.

## How I built it

**The model reads, the code decides, the human sends** — now with a fourth rule: **the assistant asks before it acts.**

- **MCP server** (`mcp/`): TypeScript, `@modelcontextprotocol/sdk` 1.30 (protocol 2025-11-25), Hono, Streamable HTTP with stateful sessions. Eleven tools written *for an orchestrating assistant*: descriptions say when to call them, outputs carry a ready-to-speak `speak` string generated from templates, so deadlines, protections and sources never pass through the model's paraphrase. The three consequential tools (draft, send, discard) refuse to act without `confirmed: true` and return the exact question to ask. Cases live in memory only and vanish on send, cancel or 30 minutes of silence.
- **Built to the Alexa+ MCP Toolkit requirements**: remote HTTPS URL, `401` with `WWW-Authenticate` for unauthenticated calls, OAuth 2.1 authorization code + PKCE (Amazon Cognito as the authorization server, the linked account's email is the only allowed recipient), sub-500 ms non-model calls. The Toolkit is partner-only during the hackathon, so the server has not been connected to a device — it is connectable by configuration, and the README has the checklist.
- **Simulated Alexa+** (`app/sim`, `app/companion`): a real MCP *client*. The orchestrator (Claude tool use behind a provider interface) receives the persona prompt and the tool list from the server over MCP — there is no private back-channel, so any standards-compliant assistant gets the same experience. Web Speech API for the microphone, Amazon Polly for the voice, typed input always available. A deterministic post-check enforces one question per turn and ≤ 60 words; violations are counted, not hidden.
- **Engine** (unchanged from LexHack, shared): extraction with a verbatim quote per fact, a deterministic rules engine over a versioned dataset (every rule with legal reference, primary source, last-verified date), letter drafting that can only cite rules the engine produced.
- **AWS**: MCP server as an ARM64 container on **Bedrock AgentCore Runtime** with a `CUSTOM_JWT` authorizer on Cognito; **SES v2** for the email with attachments; **Polly** neural voice; **Cognito** managed login for account linking. ⟦App Runner fallback used? yes/no⟧
- **Providers**: `OVERTURN_LLM_PROVIDER=anthropic|nebius`. Same engine, same samples, Claude by default and NVIDIA Nemotron on Nebius Token Factory as the second provider (⟦parity result⟧ % required-field match on the text samples).
- **Open dataset**: the state appeal rules (federal, No Surprises Act, CA, NY, TX) extracted into `us-health-appeal-rules` under MIT with schema, validator, changelog and an "add a state" guide; Overturn vendors it with a version pin and a test that fails on drift.
- **Process**: Spec Kit (constitution 1.1 → spec → plan → tasks), a written conversation design before any code (`specs/002-alexa-voice-mcp/voice-design.md`), five golden transcripts reviewed by hand, `FRICTION_LOG.md` written at the moment each friction happened.

## Built during the hackathon

| Existed before 2026-09-28 (LexHack, submitted Sept 27) | Built 2026-09-28 → 2026-10-23 |
|---|---|
| Web app (`app/` except `sim/` and `companion/`), engine (`lib/ai`, `lib/rules`, `lib/schemas`), rules data and samples (`data/`), tests for those, README/LEGAL_DESIGN | MCP server (`mcp/`), voice utilities (`lib/voice/`), simulator + companion (`app/sim`, `app/companion`, `lib/sim/`, `components/sim/`), email delivery (`lib/delivery/`), provider interface + Nebius adapter (`lib/ai/provider.ts`, `lib/ai/providers/`), infra (`infra/` — Cognito, AgentCore, App Runner), conformance and voice tests, the open dataset repository, FEEDBACK.md, FRICTION_LOG.md, constitution 1.1 |

Commit history on branch `002-alexa-voice-mcp` starts 2026-09-21 with specification documents only; the first code commit is dated ⟦date⟧.

## Challenges I ran into

- **The track's primary path is closed to individuals.** The Alexa+ MCP Toolkit is "available to select partners"; the QuickStart doesn't say so. I built to its published contract anyway and shipped the sanctioned alternative — a simulated Alexa+ driven through a real MCP client. (Friction log #1.)
- **Where does the phone upload go?** A voice assistant has no upload channel, and on AgentCore each MCP session is its own runtime. The companion page therefore belongs to the *client*, which forwards the document through a tool call — which is also the right shape for a real Alexa+ integration.
- **Making a language model ask one question at a time.** Prompts alone drift. The fix is structural: the server's state machine won't act without a confirmation, tool results carry the next question, and a post-check regenerates or truncates any turn that breaks the rule.
- ⟦Two or three real frictions from the build: AgentCore TypeScript packaging, Cognito PKCE from Vercel, SES sandbox, Web Speech quirks — copy from FRICTION_LOG.md with numbers⟧

## Accomplishments that I'm proud of

- A consequential action can't happen without an explicit yes — enforced by code on the server, not by a prompt.
- Every spoken deadline and protection names its source; every one in the email links to it.
- Any MCP client can run a full case from the tool descriptions alone (verified with MCP Inspector).
- The no-document path works with the model switched off.
- The rules dataset is now something other civic-tech builders can use without adopting Overturn.

## What I learned

- Voice is a *subtractive* medium: the design work was deciding what not to say (no letter read aloud, no URLs, no claim numbers) and where written channels take over.
- Tool descriptions are product copy. The orchestrator behaves as well as the descriptions and the `speak` strings let it.
- ⟦One learning about AgentCore / Cognito / SES from the build⟧

## What's next for Overturn

- Connect the server to Alexa+ the day the Toolkit opens (configuration, not code), then real-device testing of barge-in and long silences.
- Spanish, starting with the voice persona and the templates (the rules are data).
- More states in the open dataset, with the community — the "add a state" guide is the invitation.
- A Bedrock provider behind the same interface.

## Product feedback (summary — full text in `FEEDBACK.md`)

⟦One paragraph per tool, condensed from FEEDBACK.md: Alexa+ Toolkit docs, MCP TypeScript SDK, MCP Inspector, Cognito, AgentCore Runtime + CLI, SES, Polly, Web Speech API, Anthropic, Nebius, Vercel, Devpost — each with usage / worked / didn't / onboarding score / would reuse⟧

## Friction log

Attached: `FRICTION_LOG.md` (⟦n⟧ entries, each with task, steps, expected vs actual, severity, workaround, suggestion), written as the frictions happened.

## How to test it (for judges)

1. **Voice, in 4 minutes:** open ⟦simulator URL⟧ in Chrome, click *Link account* (sign up with any email — Cognito sends a verification code), allow the microphone, say "Alexa, my insurance denied my claim, help me appeal", then "yes", and on the companion page pick sample **02** instead of uploading. Answer as in the transcript on screen. ⟦SES sandbox note: if the account email is not verified in SES, the assistant will offer the download link instead — that is the documented fallback.⟧
2. **MCP directly:** `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, URL ⟦MCP URL⟧, bearer from ⟦how a judge obtains a token: `infra/cognito/token.sh` with the demo credentials in the Devpost private notes⟧. List tools; call `overturn_start_case`, `overturn_use_sample`, …; call `overturn_draft_letter` without `confirmed` to see the refusal.
3. **Locally:** `specs/002-alexa-voice-mcp/quickstart.md` — under 15 minutes on a clean clone.

Nothing you upload is stored; the samples are synthetic.

## Built with

TypeScript · Node 22 · Next.js 16 · React 19 · Hono · `@modelcontextprotocol/sdk` 1.30 (MCP 2025-11-25, Streamable HTTP) · `jose` · Zod 4 · Anthropic SDK (Claude) · OpenAI-compatible client for Nebius Token Factory (NVIDIA Nemotron 3) · `pdfjs-dist` · `@react-pdf/renderer` · Amazon Bedrock AgentCore Runtime · Amazon Cognito · Amazon SES · Amazon Polly · Web Speech API · Docker / ECR · Vercel · Vitest · Playwright · MCP Inspector · GitHub Spec Kit · Claude Code

*Information, not legal advice. US law only. Nothing is stored.*
