# Overturn Constitution

Overturn helps people in the United States understand and contest a health insurance
denial or an erroneous medical bill. It was built solo in nine days as a LexHack 2026 entry
(Access to Justice & Civic Tech; Legal Automation & Workflow Innovation) and is being extended,
from 2026-09-28 to 2026-10-23, for the Amazon "Build, Ship, Shape" Developer Hackathon (Alexa+
track; AWS Builder and Open Source mini-challenges) as a voice assistant driven through an MCP
server. The same codebase is the basis of a Nebius submission due 2026-10-30.

## Core Principles

### I. Information, Not Advice (NON-NEGOTIABLE)
Overturn explains what a document says, what rights and deadlines generally apply, and
what a person *can* do. It never tells a specific person what they *should* do, never
predicts the outcome of their case, and never claims to be a lawyer or a substitute for one.
This is a design constraint enforced at three layers, not a footer disclaimer:
- **Prompt layer**: every model call carries a system instruction forbidding legal
  conclusions, outcome predictions, and imperative advice; outputs use conditional,
  sourced phrasing ("Under the No Surprises Act, a patient generally cannot be billed
  more than... [45 CFR 149.410]").
- **Product layer**: every generated statement about a right or deadline links to its
  primary source (statute, CFR section, CMS/state regulator page). The appeal letter is
  presented as a *draft the user edits and owns*, with an explicit "review before sending"
  step and a pointer to free human help (state Consumer Assistance Program, ombudsman).
- **Copy layer**: UI wording is descriptive ("This looks like a prior-authorization
  denial") not prescriptive ("You must appeal"). A visible "What Overturn is / is not"
  panel is part of the first-run experience.
- **Action layer (voice, added v1.1)**: a conversational surface adds a fourth guard. The
  assistant's first turn says it gives information, not legal advice; every fact is read back
  and confirmed before it is used; drafting and sending the letter each require an explicit
  "yes" in the same turn, enforced by the server's state machine, not by the prompt; deadlines,
  protections and sources are spoken from templates over the rules dataset, never paraphrased
  by the model; "should I appeal?" and "will I win?" get one sentence and a pointer to free
  human help.
Any feature that cannot satisfy all layers that apply to its surface is out of scope.

### II. United States Only, Cited Only
All legal content is US federal law (ACA §2719 internal/external review, ERISA claims
procedure 29 CFR 2560.503-1, No Surprises Act 45 CFR Part 149) plus the explicitly
supported states. Every rule the product asserts lives in a versioned rules file with a
`source_url`, `last_verified` date, and plain-language summary. No rule without a source.
No reference to non-US law anywhere in the product or documentation. Unsupported states
get an honest fallback (federal rules only + link to the state's insurance regulator),
never a guess.

### III. Built for a Stressed Non-Expert
The primary user is someone holding a confusing letter, probably anxious, on a phone,
with ten minutes. Therefore: one task per screen; plain English at a Grade-8 reading level;
progressive disclosure (summary first, detail on demand); no jargon without an inline
definition; large touch targets; full keyboard and screen-reader support (WCAG 2.2 AA);
never a dead end — every screen offers a next step or a human alternative. Visual design
must feel calm and trustworthy (civic, not fintech-flashy).

### IV. Privacy by Construction
Uploaded documents contain protected health information. Overturn stores nothing
server-side: documents are processed in-request and discarded; no database of user
uploads; no analytics on document content. The demo uses only synthetic, anonymized sample
documents committed to the repo. Secrets live in environment variables only; a CI check
fails the build if a key pattern appears in source.
Voice cases (v1.1) live only in server memory for the life of one conversation and are
discarded on send, on cancel, or after 30 minutes of inactivity. The finished letter may be
emailed, but only to the address of the account the user linked, only after an explicit
confirmation that names that address, and never to a spoken or typed address; the uploaded
document is never emailed. Logs carry no document text, facts, letter text or email addresses.

### V. Ship the Narrow Thing, Say So Out Loud
Nine days, one person. Scope is cut to the minimum demonstrable end-to-end flow and every
cut is documented in `README.md` under "What we deliberately did not build". Supported
states, document types, and appeal types are enumerated, not implied. Honesty about limits
is part of the pitch to the jury, not a weakness to hide.

### VI. Transparent Provenance
The README declares every third-party library, model, dataset, and AI coding tool used,
with license. AI-generated legal content is labeled as such in the UI.

## Technical Constraints

- **Deployment**: the web app must stay publicly reachable by judges; every merge to `main`
  redeploys (Vercel). The MCP server (v1.1) is a self-hosted service on AWS (Bedrock AgentCore
  Runtime; App Runner as documented fallback), reachable over HTTPS, refusing unauthenticated
  requests, and built to the Alexa+ MCP Toolkit integration requirements so that a real Alexa+
  connection needs configuration, not code.
- **Stack bias**: TypeScript end-to-end; one web framework (Next.js App Router) plus one
  small service package for the MCP server; server-side model calls only (API keys never reach
  the browser); structured (JSON-schema) outputs for extraction, explanation and drafting.
- **Language models (v1.1)**: the engine talks to a provider interface, not to a vendor SDK.
  Anthropic (Claude) is the default; Nebius Token Factory (NVIDIA Nemotron) is the second
  provider. Selection is by environment variable; behaviour on the bundled samples must match
  across providers. The model never decides which rule applies, whichever provider is active.
- **Assistant protocol (v1.1)**: Model Context Protocol, specification 2025-11-25 or later,
  Streamable HTTP transport, OAuth 2.1 authorization code with PKCE (Amazon Cognito as the
  authorization server). Tool descriptions are written for an orchestrating assistant;
  consequential tools (draft, send, discard) refuse to act without a confirmation flag and
  return the exact question to ask.
- **Rules engine is deterministic**: deadlines, applicable protections, and appeal routes
  are computed from the rules file by plain code, not by the model. The model extracts
  facts and writes prose; the code decides what applies. This is auditable and it is what
  makes Principle I defensible.
- **Documents**: PDF and images (JPG/PNG) up to 10 MB; text extraction via the model's
  vision/PDF input. No OCR service to configure.
- **Language**: English only (UI, content, code, commits, docs).

## Development Workflow

- Spec → plan → tasks → implement, using Spec Kit. Scope changes go through the spec.
- Each task ends with a working deploy or a passing test; no half-wired features on `main`.
- Sample documents are the test fixtures: every supported document type has at least
  one fixture and one golden expected-extraction JSON. Voice adds golden transcripts: five
  complete conversations reviewed by hand for one-question turns, no advice, no unconfirmed
  consequential action.
- Rules data is an open dataset (v1.1): the jurisdiction files are published in a separate
  MIT-licensed repository and vendored back with a version pin; a test fails on drift.
- Hackathon hygiene (v1.1): `FRICTION_LOG.md` records each friction when it happens (task,
  steps, expected vs actual, severity, workaround, suggestion); `FEEDBACK.md` covers every
  tool, SDK, API and service used; `PROGRESS.md` is updated at the end of every working day;
  the README keeps a "Built during the hackathon" section separating pre-window work
  (feature 001, before 2026-09-28) from window work at directory granularity.
- Calendar (v1.1): code freeze 2026-10-20 at 20:00 Paris; 21-22 October reserved for the
  video and the Devpost page; submission 2026-10-23 before 18:00 Paris (deadline 12:00 PDT).
  (LexHack calendar, v1.0: freeze 2026-09-26 20:00 Paris, 2026-09-27 video and Devpost.)

## Governance

This constitution overrides convenience. Principle I and IV violations block a merge.
Amendments are recorded here with a version bump and a dated note.

**Version**: 1.1.0 | **Ratified**: 2026-09-18 | **Last Amended**: 2026-09-21

### Amendment log

- **1.1.0 - 2026-09-21** (prepared for feature `002-alexa-voice-mcp`, Amazon hackathon window
  2026-09-28 to 2026-10-23). Added: Principle I action layer for voice; Principle IV
  memory-only cases and email-delivery rule; deployment split (web on Vercel, MCP server on
  AWS); provider interface replacing the single-vendor clause; MCP/OAuth protocol constraint;
  open-dataset, hackathon-hygiene and calendar workflow items. Rationale: the Alexa+ track
  requires a self-hosted MCP server and leaves the model provider free; the AWS Builder and
  Open Source mini-challenges motivate the AWS runtime and the separate dataset repository;
  the same repository serves a Nebius submission on 2026-10-30, which is why a second
  provider sits behind one interface rather than in a fork. Principles I-VI are unchanged in
  substance; every addition tightens rather than loosens them.
