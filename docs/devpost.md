# Devpost submission text — Overturn

> Paste into the Devpost form. Fields follow Devpost's standard order. Keep the "Built with"
> list exact; it doubles as the AI/library disclosure.

**Project name:** Overturn

**Tagline:** Understand and contest a health insurance denial: plain English, real deadlines, sourced rights, a letter you can send. Information, not advice.

**Tracks:** Access to Justice & Civic Tech (primary); Legal Automation & Workflow Innovation

**Links:** Live demo: https://overturn-peach.vercel.app · Code: https://github.com/Chinorab/overturn · Video: `<YOUTUBE URL>`

---

## Inspiration

In 2024, insurers on HealthCare.gov denied 19 % of in-network claims. Consumers appealed fewer
than 1 % of them, and a third of those appeals succeeded (KFF). The gap is not motivation. It is
that the denial letter is unreadable, the rights are unknown, and the deadline is invisible. The
people most affected are the least likely to have someone who can read the letter for them.

We wanted a tool that does what a good consumer-assistance counselor does in the first twenty
minutes: read the letter with you, tell you what it means, tell you what generally applies and
by when, and help you write the first appeal. Without pretending to be a lawyer.

## What it does

Four screens, one task each, designed for a stressed person on a phone:

1. **Upload** a denial letter or Explanation of Benefits (PDF or photo), or open one of six synthetic samples.
2. **Understand**: every fact with the exact words it came from, a plain-English summary at an 8th-grade level, and the first deadline as a date with a countdown and the rule behind it.
3. **Rights**: five questions, then the protections and deadlines that apply to that situation, federal baseline plus state rules for California, New York, and Texas, each with a legal citation, a primary source, and a last-verified date.
4. **Letter**: an appeal letter drafted only from those facts and those rights, with visible `[ADD: …]` blanks for everything the tool does not know. Edit, download as PDF, or copy. Then a "before you send" checklist.

A "Get free human help" button on every screen lists the state Consumer Assistance Program and regulator. A **Know your rights** page explains the four stages of a US appeal, what each covered state adds, and answers common questions, rendered from the same rules dataset the app uses; an **About** page states the problem, the information-vs-advice line, and what happens to your document.

## How we built it

**The model reads, the code decides, the human sends.**

- **Reading**: Claude reads the PDF or image directly (no OCR pipeline) and returns structured facts through a JSON-schema output. Each fact carries a verbatim quote and a page. Absent means `null`; the prompt forbids inference. A readability gate rewrites the explanation until it reads at grade 8 or below, and a banned-phrase scan rejects advice-style wording.
- **Deciding**: which rights and deadlines apply is computed by a deterministic TypeScript engine over a versioned rules dataset (33 rules: ACA/ERISA claims procedure, No Surprises Act, CA, NY, TX). Every rule has `legal_ref`, `source_url`, and `last_verified`; a test fails the build if one is missing or older than 45 days. The engine handles "I don't know whether my plan is self-funded" by showing both routes with a caveat, and flags a letter that states a shorter deadline than the legal minimum.
- **Writing**: the letter prompt receives only the extracted facts, the user's answers, and the computed rights, and cites them with `[[cite:rule_id]]` markers. The server strips any citation the engine did not produce and re-checks the text for advice language.
- **Stack**: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, Zod 4, `@anthropic-ai/sdk`, `@react-pdf/renderer` (letter export and the synthetic samples), Vitest + Playwright with axe-core, Vercel.
- **Process**: spec-driven with GitHub's Spec Kit (constitution → spec → plan → tasks), coded solo with Claude Code. All legal content was read from primary sources (eCFR, state statutes, regulator pages) and recorded with the date read.

## Challenges we ran into

- **Structured outputs have a grammar budget.** Our first extraction schema (24 fields × value/quote/page/confidence, all nullable) was rejected twice. We flattened it to sentinel values plus a single `evidence` list, and rebuilt the strict shape in code.
- **The model wanted to be helpful.** Early drafts asserted things the patient "did not do" ("I did not sign any waiver"). One rule in the prompt, one regeneration, and that class of fabrication became a placeholder instead. We treat every such case as a design bug, not a prompt quirk.
- **Regulator websites block automated readers.** For California and Texas we cite the statute on the legislature's site and use the regulator page for the human-help entry. Where a number could not be confirmed from a primary source, it is not in the dataset.
- **A five-dollar API budget.** Every model output for the samples is cached and committed, so the demo costs nothing to run and the build cost $1.33 in total (logged in `docs/api-spend.md`).
- **Production is not development.** Playwright against the production build caught a Content Security Policy that blocked the PDF engine's WebAssembly. Fixed before anyone saw it.

## Accomplishments that we're proud of

- The information-vs-advice line is enforced in code at three layers, and the argument is written down in one page (`LEGAL_DESIGN.md`).
- Every deadline on screen shows its formula and its source. Every fact shows its quote.
- WCAG 2.2 AA with zero axe violations, light and dark, phone and desktop, keyboard-only flow, verified in CI on every push. Lighthouse on production: accessibility 100, SEO 100, performance 100 desktop / 91 mobile.
- An honest stop for Medicare, Medicaid, and TRICARE documents instead of a wrong answer.
- A rules dataset another state can be added to in half a day, with a test that refuses unsourced rules.

## What we learned

- Separating *reading* from *deciding* is what makes an AI legal-information tool defensible. It also makes it testable: the engine has a golden table; the model has fixtures.
- "I don't know" has to be a first-class answer in a legal tool, because it is the honest common case.
- Plain language is a measurable requirement, not a tone. Grade level and word count are in the tests.

## What's next for Overturn

- More states, in order of population and regulator clarity (Florida next, as the federal-process counter-example).
- Spanish, which the architecture makes cheap: rules are data, prose comes from the model.
- A letter for the *external* review step, and reminders the user opts into (without storing the document).
- Partnering with a Consumer Assistance Program to test with real counselors.

## Built with

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Zod 4 · Claude Opus 5 via `@anthropic-ai/sdk` (structured outputs, PDF/image input) · @react-pdf/renderer · date-fns · Vitest · Playwright · axe-core · Vercel · Public Sans / Source Serif 4 · Claude Code · GitHub Spec Kit

**AI and third-party disclosure:** The application calls Claude Opus 5 server-side for document reading, plain-language explanation, and letter drafting; no model was fine-tuned. Claude Code (Claude Opus 5) was used as the coding assistant throughout, with the author directing scope, design, and every legal-source verification. All libraries are open source (MIT/Apache-2.0/ISC/MPL-2.0/OFL) and listed with licenses in the README. The six sample documents are synthetic and were written for this project. Legal content summarizes public law and regulator guidance, each rule with its source and verification date.
