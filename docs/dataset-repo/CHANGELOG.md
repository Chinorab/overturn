# Changelog

All notable changes to the dataset. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) applied to **data**:

- **MAJOR** — a field, an enum value or the meaning of a field changes (consumers must update code).
- **MINOR** — a new jurisdiction, a new rule, or a corrected number/deadline (consumers must re-check
  what they show to people, since a deadline changed).
- **PATCH** — re-verification (`last_verified` bumped after re-reading the source, no content change),
  wording of `summary`/`why_template`/`caveat` without a change of meaning, help-resource contact
  details, documentation.

Every entry names the primary sources read and the date they were read. A consumer who shows
deadlines to people should pin a version and re-run their golden cases on every MINOR bump.

## [Unreleased]

## [1.0.0] - ⟦2026-10-15⟧

First public release. Extracted unchanged from [Overturn](https://github.com/Chinorab/overturn)
`data/rules/` (LexHack 2026; sources read 2026-09-18) during the Amazon Build, Ship, Shape
Developer Hackathon; re-read and `last_verified` updated on ⟦date of re-reading before release⟧.

### Added
- `rules/federal.json` — 11 rules. ERISA claims procedure (29 CFR 2560.503-1) and ACA internal
  and external review (45 CFR 147.136): at least 180 days to file an internal appeal; plan decision
  windows; free copies of the entire claim file; right to ask what diagnosis and treatment codes
  mean; independent reviewer requirement; minimum content of a denial notice; deemed exhaustion
  when the plan breaks its own procedure; 4 months to request external review; external decision
  in 45 days or 72 hours if urgent; 72-hour expedited track for urgent care; self-funded employer
  plans routed to the federal external review process (29 U.S.C. 1144).
- `rules/nsa.json` — 6 rules. No Surprises Act (45 CFR Part 149): emergency care with no balance
  billing, in-network cost sharing and no prior authorization (149.110, 149.410); out-of-network
  emergency cost sharing counting toward the in-network deductible; out-of-network provider at an
  in-network facility (149.120, 149.420); specialties that can never obtain a waiver (149.420(b));
  consent timing and form (149.420(c)); the federal No Surprises Help Desk complaint route.
  Priorities 1–6 so these lead when they apply.
- `rules/ca.json` — 6 rules. California: 6 months to apply for Independent Medical Review
  (Health & Safety Code § 1374.30(j), (k)); IMR is free (§ 1374.30(l)); grievance with the plan
  first, then the DMHC after 30 days or immediately if urgent (§ 1368(b)(1)(A)); written criteria
  and clinical reasons (§ 1368(a)(5)); IMR decision windows, up to 30 days or 7 if urgent
  (§ 1374.33; DMHC IMR program); two regulators, DMHC vs CDI (§ 1374.30; Ins. Code § 10169).
- `rules/ny.json` — 5 rules. New York: 4 months to file an external appeal with DFS (Ins. Law
  § 4914); scope beyond medical necessity (§ 4910); fee up to $25, refunded if the appeal succeeds
  (§ 4914(b)); decision in 30 days or 72 hours if expedited (§ 4914(b)); deemed reversal when the
  plan misses its internal appeal deadline (§ 4904(b), (c), (e)).
- `rules/tx.json` — 5 rules. Texas: utilization-review appeal decided within 30 calendar days
  (Ins. Code § 4201.359(a)); denied appeal must state the clinical basis and the reviewer's
  specialty (§ 4201.359(b)); medical-necessity and experimental denials eligible for an
  Independent Review Organization (ch. 4201 subch. I; 28 TAC § 19.1717; TDI IRO FAQ); IRO paid by
  the insurer, decided in 20 days or 3 days if life-threatening (28 TAC § 19.1717); TDI's scope
  ("TDI" or "DOI" on the card). The consumer's window to request IRO is not stated as a Texas
  figure: the federal 4-month floor applies and is recorded in `federal.json` only.
- `help-resources.json` — 8 entries. Federal: Consumer Assistance Programs (by state), U.S.
  Department of Labor EBSA, No Surprises Help Desk. CA: DMHC Help Center, California Department of
  Insurance consumer hotline. NY: Community Health Advocates (CAP), New York Department of
  Financial Services. TX: Texas Department of Insurance Consumer Help Line.
- `schema.json` (JSON Schema 2020-12), `validate.mjs` (dependency-free validator: schema, https
  sources, 45-day freshness, unique ids, jurisdiction/file match, help entry per state, ≤ 60-word
  summaries without advice language), `docs/adding-a-state.md`.

### Changed
- `tx.iro.eligibility`: `summary` shortened from 64 to ≤ 60 words to meet the dataset's own
  limit; meaning unchanged. ⟦confirm at release⟧

### Known limits
- Three states only (CA, NY, TX). Unsupported states get the federal baseline.
- Commercial, Marketplace and job-based plans only; no Medicare, Medicaid, CHIP, TRICARE, VA,
  dental, vision, pharmacy-only or Good Faith Estimate rules.
- Grandfathered, short-term and church plan exemptions are not modelled.
- No Consumer Assistance Program entry for Texas in this release; the TDI Consumer Help Line is
  the entry point. Contributions with a verified CAP welcome.

[Unreleased]: https://github.com/Chinorab/us-health-appeal-rules/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Chinorab/us-health-appeal-rules/releases/tag/v1.0.0
