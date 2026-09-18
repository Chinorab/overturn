# Research: Denial & Bill Appeal Assistant

**Date**: 2026-09-18 · Phase 0 of [plan.md](plan.md)

## Technical decisions

### D1. Framework & hosting — Next.js 15 on Vercel
- **Decision**: One Next.js App Router project; API routes as Node serverless functions; Vercel Git integration for deploy-on-push.
- **Rationale**: Fastest path from repo to public URL for a solo builder; server routes keep the API key off the client; preview deploys per branch are free demo insurance.
- **Alternatives**: Vite SPA + separate Express on Render (two deploys, CORS, slower); Streamlit (weak UX ceiling — UX is 20 % of the grade); SvelteKit (fine, but shadcn/Radix ecosystem is deeper for accessible primitives).

### D2. Model — Claude Opus 5 via `@anthropic-ai/sdk`, structured outputs
- **Decision**: `claude-opus-5`, adaptive thinking, `output_config.format` with a JSON schema derived from Zod for all three calls; PDF sent as a base64 `document` block, images as `image` blocks; streaming for the `draft` call.
- **Rationale**: Native PDF + vision input removes any OCR dependency; structured outputs give schema-valid JSON without prefill (prefill is rejected on this model family); Opus-tier reading accuracy matters more than cost at demo volume.
- **Alternatives**: Sonnet 5 for `extract` as a cost lever — kept as an env-var switch, not the default. Tesseract/OCR pipeline — rejected (setup time, worse on photos of letters).
- **Verify at implementation**: current TypeScript SDK shapes in the claude-api skill's `typescript/claude-api/README.md` + `tool-use.md` (structured outputs section).

### D3. Rules engine — pure TypeScript over JSON, runs in the browser
- **Decision**: `lib/rules/engine.ts` filters rules by an `applies_if` predicate and computes deadlines with `date-fns`; dataset validated by Zod in a unit test.
- **Rationale**: Deterministic and auditable (constitution); instant re-computation when answers change; identical code under test and in production.
- **Alternatives**: Let the model pick applicable rules — rejected (unauditable, hallucination risk on exactly the content that must be right). A rules DSL / json-logic — rejected (over-engineering for ~40 rules with 6 predicate fields).

### D4. Letter export — `@react-pdf/renderer`
- **Decision**: Render the edited sections to a PDF on the client; also expose copy-as-text.
- **Rationale**: Same library renders the synthetic sample documents (one tool, two uses); no server round trip; no DOCX library.
- **Alternatives**: `docx` package (adds a format nobody asked for); server-side Puppeteer (heavy on Vercel).

### D5. Session state — browser only
- **Decision**: React context + `sessionStorage` (survives refresh, dies with the tab). Nothing server-side.
- **Rationale**: Privacy principle IV; simplest possible.

### D6. Testing — Vitest + Playwright (+ axe)
- **Decision**: Unit tests for engine (golden table), schema (source/last_verified required), guard (prescriptive-phrase detection, citation subset). One Playwright e2e over a sample on a 375 px viewport with `@axe-core/playwright`.
- **Rationale**: Covers SC-003, SC-004, SC-006, SC-008 mechanically.

### D7. Secrets & CI
- **Decision**: `ANTHROPIC_API_KEY` only via Vercel env + `.env.local` (gitignored); GitHub Actions: typecheck, vitest, `gitleaks` scan, `next build`.

### D8. Rate limiting
- **Decision**: In-memory token bucket per IP in the route handler (e.g. 10 extractions / 15 min) + 10 MB / 20 page caps. Documented as demo-grade.
- **Alternatives**: Upstash Redis — unnecessary for jury traffic.

### D9. Readability check
- **Decision**: Compute Flesch-Kincaid grade server-side on `explain` output (`text-readability` or a 30-line implementation); regenerate once with a "simplify" instruction if above Grade 8.

### D10. Sample documents
- **Decision**: Six synthetic documents defined as JSON (`data/samples/*.source.json`) and rendered to PDF by `scripts/gen-sample-pdfs.ts` with a diagonal "SAMPLE — fictional" watermark; fictional insurer names (e.g. "Meridian Health Plan", "Northstar Blue"), fictional members, real-looking but non-existent addresses in the chosen states. Their model outputs are pre-computed and committed.

## Legal content to verify (the numbers live in the dataset, not here)

Each item below becomes a rule (or a set of rules) in `data/rules/`. The implementer reads the
primary source, records `legal_ref`, `source_url`, `last_verified = date read`, and the number.
Sources are listed so the verification is one WebFetch away; **no number is asserted here**.

### Federal baseline (applies to every state; ERISA self-funded plans too)
| Topic | Primary source to read |
|---|---|
| Internal appeal: consumer filing window; insurer decision windows (pre-service / post-service / urgent) | 29 CFR 2560.503-1 (ERISA claims procedure) — ecfr.gov; 45 CFR 147.136 (ACA internal claims & appeals + external review) — ecfr.gov |
| External review: filing window after final internal adverse determination; IRO decision window; expedited path | 45 CFR 147.136(d) — ecfr.gov; CMS "External Review" page — cms.gov/cciio |
| Right to the claim file, clinical criteria, and reviewer identity, free of charge | 29 CFR 2560.503-1(h)(2)(iii) and (m)(8) — ecfr.gov |
| Notice content requirements (what a denial letter must contain — used to flag deficient letters) | 29 CFR 2560.503-1(g); 45 CFR 147.136(b)(2)(ii)(E) |
| Deemed exhaustion when the plan violates procedure | 29 CFR 2560.503-1(l) |
| Consumer Assistance Program list | cms.gov/cciio/resources/consumer-assistance-grants |

### No Surprises Act
| Topic | Primary source to read |
|---|---|
| Emergency services protection (in-network cost sharing, balance-billing prohibition) | 45 CFR 149.110; PHS Act §2799A-1 — ecfr.gov |
| Non-emergency services by OON providers at in-network facilities; notice-and-consent exceptions | 45 CFR 149.120, 149.420 — ecfr.gov |
| Air ambulance | 45 CFR 149.130 |
| Provider balance-billing prohibition | 45 CFR 149.410 |
| Complaint channel (No Surprises Help Desk) | cms.gov/nosurprises |

### California
| Topic | Primary source to read |
|---|---|
| Which regulator (DMHC vs CDI) and how a consumer tells | dmhc.ca.gov; insurance.ca.gov |
| Grievance/internal appeal window; plan response window; urgent grievances | Cal. Health & Safety Code §1368; 28 CCR 1300.68 — leginfo.legislature.ca.gov |
| Independent Medical Review: eligibility, filing window after plan decision, when internal appeal can be skipped, decision timelines, cost (none) | Cal. Health & Safety Code §1374.30–1374.36; DMHC "IMR" page |
| CDI independent medical review (for CDI-regulated policies) | Cal. Ins. Code §10169 |
| Help Center phone/URL | dmhc.ca.gov/FileaComplaint |

### New York
| Topic | Primary source to read |
|---|---|
| Internal appeal window; plan decision windows; expedited | NY Ins. Law §4904; Public Health Law §4904 — nysenate.gov |
| External appeal: filing window after final adverse determination, fee (and refund/waiver), DFS decision windows, expedited | NY Ins. Law §4914; DFS "External Appeals" page — dfs.ny.gov |
| Surprise-bill / emergency protections that complement NSA | NY Fin. Services Law Art. 6 |
| Community Health Advocates (NY CAP) | communityhealthadvocates.org |

### Texas
| Topic | Primary source to read |
|---|---|
| Internal appeal window; decision windows; expedited | Tex. Ins. Code Ch. 4201 (utilization review); 28 TAC Ch. 19 Subch. R — statutes.capitol.texas.gov |
| Independent Review Organization: eligibility, filing window, decision windows, cost | Tex. Ins. Code §4201.351–.360; TDI "IRO" page — tdi.texas.gov |
| TX surprise-billing law (SB 1264) relation to NSA; mediation/arbitration | Tex. Ins. Code Ch. 1467 |
| TDI Consumer Help Line | tdi.texas.gov/consumer |

### Which plans state rules reach
| Topic | Primary source to read |
|---|---|
| ERISA preemption: state external-review laws generally do not apply to self-funded plans; federal external review process does | 29 U.S.C. §1144; 45 CFR 147.136(d) preamble; DOL EBSA appeals page |
| How a consumer finds out whether a plan is self-funded (SPD, HR, insurer card wording) | DOL "Filing a claim for your health benefits" |

### Denial-category → strongest angle (content for `why_template` + letter templates)
| Category | Angle to document |
|---|---|
| Medical necessity | Request criteria used + reviewer credentials; treating-physician letter; peer-to-peer |
| Prior authorization | Emergency exception; retroactive authorization; plan's own notice failures |
| Out-of-network | NSA emergency / in-network-facility protection; network adequacy; continuity of care |
| Not covered / exclusion | Ask for the exact plan language; benefit-vs-exclusion ambiguity resolved against drafter; ACA essential health benefits |
| Coding / administrative | Corrected claim from provider; duplicate-claim reconciliation |
| Experimental / investigational | Definition in plan; FDA status; guideline citations; IMR/external review specifically covers this |
| Timely filing | Provider's responsibility when in-network; proof of timely submission |
| Duplicate claim | Request the paid-claim reference; ask provider to void/resubmit |

## Open items carried into tasks
- Read every source above on Day 2 and fill the dataset (task T-RULES-VERIFY).
- Confirm Vercel Hobby 60 s function limit is enough for 20-page PDFs; else switch `extract` to streaming or Pro.
