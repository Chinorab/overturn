# Implementation Plan: Denial & Bill Appeal Assistant

**Branch**: `001-denial-appeal-assistant` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-denial-appeal-assistant/spec.md`

## Summary

A single Next.js application, deployed on Vercel, that (1) reads a denial letter or EOB with
the Claude API using structured outputs, (2) runs a deterministic TypeScript rules engine over
a versioned JSON rules dataset (federal + CA/NY/TX) to compute applicable protections and
deadlines, and (3) drafts an editable appeal letter constrained to the extracted facts and the
computed rights. No database, no auth, no persisted PHI. The architectural thesis for the jury:
**the model reads, the code decides, the human sends.**

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (Vercel runtime)

**Primary Dependencies**: Next.js 15 (App Router, Server Actions / Route Handlers), React 19,
Tailwind CSS 4, shadcn/ui (Radix primitives), `@anthropic-ai/sdk` (Messages API, PDF/image
document input, structured outputs via `output_config.format`), Zod (schemas shared between
model output validation, rules engine, and UI), `@react-pdf/renderer` (letter PDF), `date-fns`
(deadline math), `lucide-react` (icons)

**Storage**: N/A — no database. Per-session state in browser memory (React state +
`sessionStorage` for refresh survival). Cached extractions for the bundled samples are static
JSON files committed to the repo.

**Testing**: Vitest (rules engine golden table, extraction schema, letter constraints);
Playwright (one end-to-end sample flow, mobile viewport, axe accessibility scan)

**Target Platform**: Vercel (Node serverless functions, 60 s max duration on Hobby — Pro
if needed for PDF extraction latency); modern browsers, mobile-first

**Project Type**: Single web application (frontend + server routes in one Next.js project)

**Performance Goals**: Extraction result ≤ 60 s (target 15–25 s for a 2-page PDF); letter
generation ≤ 30 s; sample flow instant (pre-computed); Lighthouse a11y ≥ 95, performance ≥ 85 mobile

**Constraints**: No PHI persisted; API key server-only; 10 MB / 20 pages upload cap; English
only; WCAG 2.2 AA; no prescriptive language in generated output (validated by a lint pass on
the model output)

**Scale/Scope**: ~6 screens; 1 model integration with 3 prompts (extract, explain, draft);
1 rules dataset (~35–45 rules); 6 sample documents; solo developer, 9 days

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I. Information, not advice | Three layers (prompt / product / copy) each map to a concrete artifact: system prompts in `lib/ai/prompts/`, `sources` on every rule + "review before sending" step, copy lint in `lib/ai/guard.ts` and a UX copy deck | PASS — see tasks T-GUARD |
| II. US only, cited only | Rules dataset schema requires `source_url` + `last_verified`; Zod refuses a rule without them; unsupported states → federal fallback | PASS |
| III. Built for a stressed non-expert | One task per screen, 4-step stepper, Grade-8 copy, 44 px targets, axe in CI | PASS — design brief below |
| IV. Privacy by construction | No DB, no upload storage, no analytics on content, gitleaks check in CI, synthetic samples | PASS |
| V. Ship the narrow thing | Scope table in spec; README "not built" section is a task | PASS |
| VI. Transparent provenance | README credits section is a task; UI "AI-assisted" label component | PASS |
| Deterministic rules engine | `lib/rules/engine.ts` is pure; the model never receives the rules dataset; the letter prompt receives the *computed* rights as input | PASS |

Post-design re-check: no violations. No Complexity Tracking entries needed.

## Architecture

```
Browser (Next.js client components)
  │  upload / pick sample        answers            edit + download
  ▼                              ▼                  ▼
POST /api/extract        (pure client)        POST /api/draft
  │  PDF/image → Claude   rules engine runs      │  facts + answers + rights
  │  structured output    in the browser         │  → Claude → letter JSON
  │  Zod-validated        (deterministic,        │  → guard lint (no "should",
  │  + confidence         same code unit-tested) │    no rules not in input)
  ▼                              ▼                  ▼
Extraction JSON  ───────►  RightsResult  ─────────►  LetterDraft  ──► @react-pdf → PDF
```

Why the rules engine runs client-side: it is pure TypeScript over a static dataset, so it
needs no secret, gives instant feedback when the user changes an answer, and makes the
"the code decides" claim literally inspectable in the browser devtools. The same module is
unit-tested against the golden table.

### Model calls (all server-side, `claude-opus-5`, adaptive thinking)

| Call | Input | Output (structured) | Notes |
|---|---|---|---|
| `extract` | document block (PDF base64 or image) + system prompt | `Extraction` Zod schema with per-field `{value, confidence, quote}` | `output_config.format` JSON schema from Zod; effort `medium`; refuses to invent: schema allows `null` |
| `explain` | Extraction (facts only) + glossary | `{summary: string, terms: [{term, definition}]}` | readability checked server-side (Flesch-Kincaid); regenerate once if > Grade 8 |
| `draft` | Extraction + answers + RightsResult (with citations) | `{sections: [{id, heading, text}], placeholders: string[]}` | guard: every citation in text must be in RightsResult; no prescriptive phrases; else regenerate once, then surface warning |

Sample documents ship with pre-computed `extract` and `explain` outputs so the demo never
depends on the API being up (SC-007). Live uploads are rate-limited per IP (simple in-memory
token bucket per serverless instance — good enough for a jury demo; documented as such).

### Rules dataset

`data/rules/*.json`, one file per jurisdiction (`federal.json`, `ca.json`, `ny.json`,
`tx.json`, `nsa.json`) + `help-resources.json`. Each rule:

```
id, jurisdiction, category (deadline | protection | right | process),
title, summary (plain English), legal_ref, source_url, last_verified,
applies_if: { plan_source?: [...], self_funded?: bool|"unknown", denial_category?: [...],
              emergency?: bool, urgent?: bool, state?: [...] },
deadline?: { anchor: "letter_date"|"final_internal_denial_date"|"service_date",
             amount: number, unit: "days"|"months", who: "consumer"|"insurer" },
priority: number, why_template: string
```

Validated by Zod at build time (a test fails if any rule lacks a source or a verification date).
Legal numbers are populated during the research task from primary sources (Phase 0 output
lists the sources to read; the numbers themselves are recorded in the dataset, not in this plan).

## Design Brief (UX weighs 20 %)

Derived from the `ui-ux-pro-max` recommendation ("Accessible & Ethical" style for
government/healthcare/legal) adapted to the audience.

- **Tone**: calm, civic, competent. Not fintech, not "AI product". Think a well-designed
  state agency site that finally respects your time.
- **Palette** (light mode default, dark mode supported): deep teal-navy primary `#134E5E`,
  ink `#1B1F24`, warm paper background `#FAF8F4`, muted `#EEF2F3`, accent for progress /
  success green `#0E7C5B`, deadline-warning amber `#B7791F`, destructive `#B42318`.
  All text ≥ 4.5:1. Avoid cyan, neon, purple gradients.
- **Type**: Public Sans (US Web Design System's typeface — a deliberate civic signal) for
  UI/body at 17 px base, 1.55 line height; Source Serif 4 for the letter preview and the
  H1 on the landing page. Both Google Fonts, `font-display: swap`.
- **Layout**: single centered column (max 680 px), 4-step stepper always visible
  (Upload → Understand → Rights → Letter); each step is one screen with one primary action.
  Mobile-first at 375 px; no horizontal scroll; 44 px targets.
- **Signature components**:
  - *Deadline clock*: large date + "N days left" + anchor formula + source link; amber
    under 30 days, red under 7, neutral otherwise; never color-only (icon + text).
  - *Fact card with quote*: every extracted field shows the verbatim snippet it came from
    on hover/tap ("Where did this come from?") — this is the trust mechanic.
  - *Rights list*: ordered cards, each with a one-line "why this applies to you" and a
    source chip; expandable detail.
  - *Letter editor*: serif preview with inline placeholders rendered as highlighted chips
    `[ADD: date of your call with the insurer]`; edits persist; download bar sticky on mobile.
  - *"Is / Is not" panel* on landing and in a persistent footer sheet.
  - *Human help drawer*: state CAP / regulator contact, always reachable.
- **Motion**: 150–250 ms ease-out on step transitions and card reveals; skeleton
  screens during extraction with a plain-language progress line ("Reading page 2 of 2…");
  `prefers-reduced-motion` honored.
- **Copy rules**: descriptive not prescriptive; second person; every jargon term gets a
  dotted-underline inline definition; no exclamation marks; no "Congratulations".
- **Empty/error states** are designed screens, not toasts: unreadable document, unsupported
  plan type, model unavailable, deadline passed.

## Project Structure

### Documentation (this feature)

```text
specs/001-denial-appeal-assistant/
├── plan.md              # This file
├── research.md          # Phase 0: decisions + legal sources to verify
├── data-model.md        # Phase 1: entities and schemas
├── quickstart.md        # Phase 1: run + validate
├── contracts/
│   ├── api-extract.md   # POST /api/extract
│   ├── api-draft.md     # POST /api/draft
│   └── rules-schema.md  # rules dataset contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                 # fonts, theme, skip link, help drawer
├── page.tsx                   # landing: is/is-not, try a sample, upload
├── (flow)/
│   ├── understand/page.tsx    # step 2: summary + fact cards + deadline clock + confirm fields
│   ├── rights/page.tsx        # step 3: questions + rights list
│   └── letter/page.tsx        # step 4: editor + checklist + download
├── unsupported/page.tsx       # honest stop screen (Medicare/Medicaid/other)
└── api/
    ├── extract/route.ts       # Claude extraction + explanation
    └── draft/route.ts         # Claude letter drafting + guard
components/
├── ui/                        # shadcn primitives
├── stepper.tsx
├── deadline-clock.tsx
├── fact-card.tsx
├── rights-card.tsx
├── letter-editor.tsx
├── help-drawer.tsx
├── is-is-not.tsx
└── ai-label.tsx
lib/
├── ai/
│   ├── client.ts              # Anthropic client (server only)
│   ├── prompts/{extract,explain,draft}.ts
│   ├── extract.ts / explain.ts / draft.ts
│   └── guard.ts               # prescriptive-language + citation-subset lint
├── rules/
│   ├── schema.ts              # Zod rule schema
│   ├── engine.ts              # pure: (Situation) → RightsResult
│   ├── deadlines.ts           # date math
│   └── load.ts                # loads data/rules/*.json
├── schemas/                   # Extraction, Situation, LetterDraft (Zod)
├── readability.ts
└── session.ts                 # sessionStorage helpers
data/
├── rules/{federal,nsa,ca,ny,tx}.json
├── help-resources.json
├── glossary.json
└── samples/
    ├── 01-medical-necessity-ny.pdf (+ .extraction.json, .explain.json)
    ├── 02-prior-auth-ca.pdf
    ├── 03-oon-emergency-tx-eob.pdf
    ├── 04-not-covered-federal-only.pdf
    ├── 05-coding-error-eob-ny.pdf
    └── 06-medicare-unsupported.pdf
tests/
├── unit/rules.engine.test.ts  # golden table
├── unit/rules.schema.test.ts  # every rule has source + last_verified
├── unit/guard.test.ts
└── e2e/sample-flow.spec.ts    # Playwright + axe
scripts/
├── gen-sample-pdfs.ts         # renders the synthetic samples from JSON via @react-pdf
└── precompute-samples.ts      # runs extract/explain once, commits outputs
.github/workflows/ci.yml       # typecheck, vitest, gitleaks, build
```

**Structure Decision**: single Next.js project; server routes replace a separate backend.
The rules engine and schemas are framework-free modules under `lib/` so they are testable
without Next.

## Phase 0 → research.md; Phase 1 → data-model.md, contracts/, quickstart.md (generated).
