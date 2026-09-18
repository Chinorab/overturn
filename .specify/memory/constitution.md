# Overturn Constitution

Overturn helps people in the United States understand and contest a health insurance
denial or an erroneous medical bill. It is a LexHack 2026 entry (tracks: Access to Justice
& Civic Tech; Legal Automation & Workflow Innovation), built solo in nine days.

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
Any feature that cannot satisfy all three layers is out of scope.

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

### V. Ship the Narrow Thing, Say So Out Loud
Nine days, one person. Scope is cut to the minimum demonstrable end-to-end flow and every
cut is documented in `README.md` under "What we deliberately did not build". Supported
states, document types, and appeal types are enumerated, not implied. Honesty about limits
is part of the pitch to the jury, not a weakness to hide.

### VI. Transparent Provenance
The README declares every third-party library, model, dataset, and AI coding tool used,
with license. AI-generated legal content is labeled as such in the UI.

## Technical Constraints

- **Deployment**: must be publicly reachable by the jury from day 4 onward; every merge
  to `main` redeploys. Prefer platforms with zero-ops deploys (Vercel).
- **Stack bias**: TypeScript end-to-end; one framework (Next.js App Router); server-side
  model calls only (API keys never reach the browser); the Claude API for extraction,
  explanation, and drafting with structured (JSON-schema) outputs.
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
  one fixture and one golden expected-extraction JSON.
- Sept 27 is reserved entirely for video, screenshots, and the Devpost page. Code freeze
  on Sept 26, 20:00 Paris.

## Governance

This constitution overrides convenience. Principle I and IV violations block a merge.
Amendments are recorded here with a version bump and a dated note.

**Version**: 1.0.0 | **Ratified**: 2026-09-18 | **Last Amended**: 2026-09-18
