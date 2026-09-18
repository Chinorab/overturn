# Tasks: Denial & Bill Appeal Assistant

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Organization**: phases map to user stories; each phase ends with something deployable.
Day assignments are the target schedule (Sept 18 → 27, 2026). `[P]` = parallelizable with
neighbours (different files). All tasks are solo; "parallel" means "no ordering constraint".

## Format: `[ID] [P?] [Story] Description — file(s)`

---

## Phase 1: Setup — Day 1 (Thu Sept 18, after scope validation)

- [x] T001 Scaffold Next.js 15 + TypeScript + Tailwind 4 + shadcn/ui; pnpm; strict TS — `package.json`, `app/layout.tsx`, `tailwind.config.ts`
- [x] T002 [P] Add fonts (Public Sans, Source Serif 4), design tokens from the plan's design brief as CSS variables, light/dark — `app/globals.css`
- [x] T003 [P] Vitest + Playwright + `@axe-core/playwright` config; `pnpm test`, `pnpm test:e2e` scripts — `vitest.config.ts`, `playwright.config.ts`
- [x] T004 [P] GitHub repo (public), `.gitignore` incl. `.env*`, `.specify/feature.json`; CI: typecheck, vitest, gitleaks, build — `.github/workflows/ci.yml`
- [ ] T005 (waiting: Vercel dashboard link by the owner) Vercel project linked to `main`; `ANTHROPIC_API_KEY` set in Vercel env; first deploy of the scaffold (public URL exists on Day 1) — Vercel dashboard
- [x] T006 [P] `README.md` skeleton with sections: Problem, What it does, What it deliberately does not do, Architecture, Legal design ("information, not advice"), Privacy, Stack & credits, Run locally — `README.md`

**Checkpoint**: public URL shows a styled placeholder landing page; CI green.

---

## Phase 2: Foundation (rules + schemas) — Day 2 (Fri Sept 19)

- [x] T010 Zod schemas: `Field<T>`, `Extraction`, `Explanation`, `Situation`, `LetterDraft`, `HelpResource` — `lib/schemas/*.ts`
- [x] T011 Zod `Rule` schema + loader — `lib/rules/schema.ts`, `lib/rules/load.ts`
- [x] T012 **T-RULES-VERIFY** Read every primary source listed in research.md; author `federal.json`, `nsa.json`, `ca.json`, `ny.json`, `tx.json` with `legal_ref`, `source_url`, `last_verified = 2026-09-19`, plain summaries, `why_template`, caveats — `data/rules/*.json` *(biggest single task of the build; budget the full afternoon)*
- [x] T013 [P] `help-resources.json` (federal CAP list page, CMS No Surprises Help Desk, DMHC Help Center, CDI, NY DFS + Community Health Advocates, TDI Consumer Help Line) — `data/help-resources.json`
- [x] T014 [P] `glossary.json` (~25 terms: EOB, adverse benefit determination, prior authorization, medical necessity, allowed amount, balance billing, in-network, external review, IRO, IMR, self-funded, ERISA, SPD, peer-to-peer, CARC…) — `data/glossary.json`
- [x] T015 Rules engine: applicability, deadlines, letter-stated-deadline discrepancy, ordering, federal-only fallback — `lib/rules/engine.ts`, `lib/rules/deadlines.ts`
- [x] T016 Schema test (every rule has https source + fresh `last_verified` + legal_ref) — `tests/unit/rules.schema.test.ts`
- [x] T017 Golden table: ≥ 12 situations covering (CA|NY|TX|other) × (fully insured|self-funded|unknown) × key denial categories × emergency; engine test — `tests/unit/golden/*.json`, `tests/unit/rules.engine.test.ts`

**Checkpoint**: `pnpm test` green; the engine is demonstrably correct before any AI code exists.

---

## Phase 3: US1 — Understand my denial — Days 3–4 (Sat–Sun Sept 20–21)

- [x] T020 Anthropic client (server-only), model + effort from env with `claude-opus-5` default — `lib/ai/client.ts`
- [x] T021 Extraction prompt (system: extraction-only, null for absent, verbatim quotes, taxonomy definitions, program detection) + structured output from Zod → JSON schema — `lib/ai/prompts/extract.ts`, `lib/ai/extract.ts`
- [x] T022 Explanation prompt (Grade-8, ≤120 words, glossary terms, descriptive not prescriptive) + readability check + one regeneration — `lib/ai/prompts/explain.ts`, `lib/ai/explain.ts`, `lib/readability.ts`
- [x] T023 `POST /api/extract`: multipart parsing, size/type/page caps, rate limit, unsupported-program gate (422), Zod validation + retry, sample_id short-circuit, no logging of content — `app/api/extract/route.ts`
- [x] T024 Sample sources (6 synthetic documents as JSON: NY medical necessity letter; CA prior-auth letter; TX ER out-of-network EOB; federal-only "not covered" letter (state = FL); NY coding-error EOB; Medicare letter) — `data/samples/*.source.json`
- [x] T025 Sample PDF generator with "SAMPLE — fictional" watermark, realistic layout (letterhead, member block, claim table, appeal-rights paragraph) — `scripts/gen-sample-pdfs.ts`
- [x] T026 Precompute script → `*.extraction.json`, `*.explain.json` committed — `scripts/precompute-samples.ts`
- [x] T027 Session store (context + sessionStorage) and flow state machine — `lib/session.ts`
- [x] T028 Landing page: H1, one-sentence promise, **Is / Is not** panel, privacy statement, "Try a sample" (6 cards), upload dropzone (mobile camera capture allowed) — `app/page.tsx`, `components/is-is-not.tsx`
- [x] T029 Stepper + layout chrome + skip link + AI-assisted label component — `components/stepper.tsx`, `components/ai-label.tsx`, `app/layout.tsx`
- [x] T030 Understand screen: extraction skeleton with progress line; summary; fact cards with "where did this come from?" quote reveal; low-confidence fields flagged + editable confirm form; deadline clock (federal internal appeal preview from letter date) — `app/(flow)/understand/page.tsx`, `components/fact-card.tsx`, `components/deadline-clock.tsx`
- [x] T031 Designed error/empty states: unreadable, unsupported (Medicare/Medicaid/non-English), too large, model unavailable — `app/unsupported/page.tsx`, `components/state-screens.tsx`
- [x] T032 Deploy; run the 6 samples live; tune the extraction prompt against golden `*.extraction.json` until ≥ 90 % field match (SC-002) — `tests/unit/extraction.golden.test.ts` (offline compare of cached outputs)

**Checkpoint (end Day 4)**: public URL: upload or pick a sample → understand screen with facts, explanation, deadline. **This alone is a submittable MVP.**

---

## Phase 4: US2 — Rights & deadlines — Day 5 (Mon Sept 22)

- [x] T040 Questions screen: state (pre-filled from `state_hint`, searchable select), plan source, self-funded (with "how to find out" helper), emergency / in-network facility, urgent — one question per card, big radio targets — `app/(flow)/rights/page.tsx`
- [x] T041 Rights list: ordered cards with "why this applies" + caveat + source chip + expandable detail; NSA first when applicable; federal-only note for unsupported states — `components/rights-card.tsx`
- [x] T042 Deadline clock full version: multiple clocks (internal, external), anchor formula, discrepancy handling, "passed" state with what remains possible — `components/deadline-clock.tsx`
- [x] T043 Help drawer (persistent entry point; content from `help-resources.json` for chosen state) — `components/help-drawer.tsx`
- [x] T044 e2e: sample 01 flow through rights at 375 px + axe — `tests/e2e/sample-flow.spec.ts`

**Checkpoint**: deploy; US1 + US2 live.

---

## Phase 5: US3 — The letter — Days 6–7 (Tue–Wed Sept 23–24)

- [x] T050 Draft prompt: inputs = facts + answers + computed rights (with `legal_ref`); rules: only these facts, `[ADD: …]` for unknowns, `[[cite:rule_id]]` markers, per-category argument templates, requests block (claim file, criteria, reviewer credentials, written decision), non-prescriptive register — `lib/ai/prompts/draft.ts`, `lib/ai/draft.ts`
- [x] T051 Guard: citation-subset check, prescriptive-phrase scan, single regeneration, `guard_report` — `lib/ai/guard.ts`, `tests/unit/guard.test.ts`
- [x] T052 `POST /api/draft` (JSON + SSE streaming) — `app/api/draft/route.ts`
- [x] T053 Letter screen: serif preview, section-level editing, placeholder chips, streaming reveal, guard warnings highlighted, attachment checklist, where-to-send block with verify note, "Before you send" panel, human-help pointer — `app/(flow)/letter/page.tsx`, `components/letter-editor.tsx`
- [x] T054 PDF export via `@react-pdf/renderer` + copy-as-text; sticky download bar on mobile — `components/letter-pdf.tsx`
- [x] T055 Precompute sample letters too (demo resilience) — extend `scripts/precompute-samples.ts`
- [x] T056 Deploy; full e2e extended to download — `tests/e2e/sample-flow.spec.ts`

**Checkpoint (end Day 7)**: complete flow live. Feature freeze on new scope.

---

## Phase 6: Polish, trust, docs — Day 8 (Thu Sept 25)

- [x] T060 Copy pass over every screen against the copy rules (descriptive, Grade 8, inline definitions, no exclamation marks); prescriptive-language grep over `app/` and `components/` — all UI files
- [x] T061 Accessibility pass: keyboard-only run, screen-reader announcements (`aria-live` on async results), focus management between steps, reduced motion; Lighthouse ≥ 95 a11y on all screens — all UI files
- [x] T062 Dark mode check, 375/768/1024/1440 check, no horizontal scroll — `app/globals.css`
- [x] T063 README complete: problem (with sourced stats), solution, "the model reads, the code decides, the human sends", legal design section (three layers), privacy, supported scope table + "not built" table, stack & credits (every lib, model, AI tool incl. Claude Code), local run, screenshots placeholders — `README.md`
- [x] T064 [P] `LEGAL_DESIGN.md`: the UPL argument in one page for the jury (what constitutes practice of law vs. legal information; how each layer avoids it; sources) — `LEGAL_DESIGN.md`
- [x] T065 [P] `data/rules/README.md`: how to add a state (schema, verification, golden test) — proves extensibility claim
- [x] T066 Security review of routes (size caps, rate limit, no content logging, headers) — `app/api/*`

---

## Phase 7: Buffer & rehearsal — Day 9 (Fri Sept 26) — **code freeze 20:00 Paris**

- [ ] T070 Fix anything found in T060–T066; re-run all tests; final deploy; verify on a real phone
- [ ] T071 Write the video script (2:30): 0:00 problem (15 s) → 0:15 sample upload → 0:45 understand + deadline → 1:15 rights (NSA moment) → 1:45 letter + download → 2:15 "information not advice" + not-built honesty → 2:30 — `docs/video-script.md`
- [ ] T072 Rehearse the demo path twice on the deployed URL with OBS/screen recorder; take the 6–8 screenshots (landing mobile, understand, fact quote reveal, deadline clock, rights with NSA, letter with placeholders, download, is/is-not) — `docs/screenshots/`
- [ ] T073 Draft the Devpost text offline (inspiration, what it does, how we built it, challenges, accomplishments, what we learned, what's next, built with) — `docs/devpost.md`

---

## Phase 8: Submission — Day 10 (Sat Sept 27) — no code

- [ ] T080 Record voice-over + screen (2–3 takes), edit to ≤ 3:00, upload (YouTube unlisted)
- [ ] T081 Devpost page: text from T073, video, screenshots, deployed URL, GitHub URL, AI/library disclosure, tracks
- [ ] T082 Submit by 17:00 EDT / 23:00 Paris — **target 20:00 Paris** to keep a 3-hour buffer

---

## Dependencies

- Phase 2 (rules) before Phase 4 (rights UI); Phase 3 (extraction) before Phase 4 (needs `state_hint`, category).
- Phase 5 needs both 3 and 4.
- T012 (legal verification) is the critical-path content task; if it overruns, cut TX before cutting anything else (keep CA + NY: two regulator models still prove the architecture).

## Cut list if behind (in order)
1. SSE streaming for the letter (return full JSON) — T052
2. Texas overlay — T012/T017 subset
3. Dark mode — T062
4. Sample 05 (coding-error EOB) — keep 5 samples
5. Playwright e2e (keep unit tests + manual checklist) — T044/T056
