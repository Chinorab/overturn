# us-health-appeal-rules

**Machine-readable rules for appealing a health insurance denial in the United States —
deadlines, protections, appeal routes — each with its legal reference, primary source, and the
date a human last verified it.**

Federal baseline (ACA / ERISA claims and appeals), the No Surprises Act, and state overlays for
**California, New York and Texas**. 33 rules. JSON, schema-validated, MIT.

Extracted from [Overturn](https://github.com/Chinorab/overturn), where a deterministic engine
applies these rules and a language model is only allowed to cite what the engine selected. The
dataset is published separately so that other tools — assistants, chatbots, clinic intake forms,
legal-aid triage — can reuse the same facts without adopting Overturn.

> **Information, not legal advice.** This dataset describes what rules generally say. It does not
> decide whether a rule applies to a particular person, predict outcomes, or replace a state
> Consumer Assistance Program, an ombudsman, or a lawyer.

## What's inside

```
rules/
  federal.json   11 rules  ACA §2719 / ERISA 29 CFR 2560.503-1: internal appeal window, decision
                           timeframes, urgent/expedited review, external review, right to the claim file
  nsa.json        6 rules  No Surprises Act, 45 CFR Part 149: emergency care, out-of-network care at
                           in-network facilities, air ambulance, cost-sharing and balance-billing limits
  ca.json         6 rules  California: DMHC/CDI grievance and Independent Medical Review
  ny.json         5 rules  New York: DFS external appeal, utilization-review timelines
  tx.json         5 rules  Texas: TDI, utilization-review decisions, Independent Review Organizations
help-resources.json        Free human help per jurisdiction (8 entries): Consumer Assistance Programs, regulators,
                           help desks (name, kind, phone, URL, what they do)
schema.json                JSON Schema (draft 2020-12) for rule files and help resources
validate.mjs               `node validate.mjs` — schema, https sources, freshness (see below)
CHANGELOG.md · VERSION     Semantic version of the data; consumers pin it
docs/adding-a-state.md     How to contribute a state overlay (about half a day)
```

## One rule

```json
{
  "id": "tx.internal_appeal.decision_30_days",
  "jurisdiction": "TX",
  "category": "process",
  "title": "Texas: the plan must decide your appeal within 30 calendar days",
  "summary": "A Texas utilization review agent must send written notice of its appeal decision as soon as practicable and no later than the 30th calendar day after it receives your appeal.",
  "legal_ref": "Tex. Ins. Code § 4201.359(a)",
  "source_url": "https://texas.public.law/statutes/tex._ins._code_section_4201.359",
  "last_verified": "2026-09-18",
  "applies_if": { "state": ["TX"], "self_funded": "no", "denial_category": ["medical_necessity", "experimental", "prior_auth"] },
  "priority": 44,
  "why_template": "Note the date you send the appeal; the plan's clock in Texas is 30 days."
}
```

| Field | Meaning |
|---|---|
| `id` | Stable identifier `jurisdiction.topic.detail`; never reused after removal |
| `jurisdiction` | `federal` · `nsa` · state code |
| `category` | `deadline` (a clock), `protection` (a limit on what can be billed/denied), `right` (something the person may request), `process` (what the plan must do, by when) |
| `summary` | Plain English, Grade 8, ≤ 60 words — safe to show or speak to a consumer |
| `legal_ref` | Statute or regulation section as a lawyer would cite it |
| `source_url` | The **primary** source a human read: eCFR, the state legislature, or the regulator. Always `https`. |
| `last_verified` | The date that human read it. Rules older than 45 days fail validation. |
| `applies_if` | Conditions, **ANDed**; an omitted key matches anything (details below) |
| `deadline` | Optional: `anchor` (`letter_date`, `final_internal_denial_date`, `service_date`), `amount`, `unit` (`days`/`months`/`hours`), `who` (`consumer` → a clock for the person; `insurer` → informational) |
| `priority` | Display order within a jurisdiction, lower first; NSA rules use 1–6 so they lead when they apply |
| `why_template` | One sentence explaining *why this applies*, true whether or not plan funding is known |
| `caveat` | Optional sentence shown when the rule is displayed under uncertainty |

### `applies_if` semantics

- `state`: list of state codes. Federal and NSA rules omit it.
- `plan_source`: `employer` · `marketplace` · `direct` · `other`.
- `self_funded`: `"no"` = **insured plans only** — state insurance law reaches them; self-funded
  ERISA plans are federal-only. `"yes"` = self-funded only. `"any"`/omitted = regardless. When a
  consumer does not know their plan's funding, a careful consumer should still be shown `"no"`
  rules with the `caveat` — that is what Overturn does.
- `denial_category`: `medical_necessity` · `prior_auth` · `out_of_network` · `not_covered` ·
  `coding_admin` · `experimental` · `timely_filing` · `duplicate` · `other`.
- `emergency`, `urgent`: booleans. `document_type`: `denial_letter` · `eob` · `other`.

## Using it

```bash
git clone https://github.com/Chinorab/us-health-appeal-rules
node validate.mjs            # exits non-zero on any schema, source or freshness problem
```

Any JSON reader works. A minimal selector in pseudocode:

```
applicable = rules.filter(r => every key in r.applies_if matches the situation)
deadlines  = applicable.filter(r => r.deadline && r.deadline.who == "consumer")
             .map(r => anchor_date(r.deadline.anchor) + r.deadline.amount r.deadline.unit)
```

Pin a version: read `VERSION` (semver) or a git tag. **Data changes are breaking by default** for
a consumer that shows deadlines to people; re-verify your golden cases on every bump.

Reference implementation of a selector and deadline calculator: Overturn's
[`lib/rules/engine.ts`](https://github.com/Chinorab/overturn/blob/main/lib/rules/engine.ts)
(TypeScript, MIT) and its golden table test.

## Coverage and limits — read before relying on it

| Covered | Not covered (and why) |
|---|---|
| Job-based plans (insured **and** self-funded/ERISA), ACA Marketplace plans, individual commercial plans | **Medicare, Medicaid, CHIP, TRICARE, VA** — entirely different multi-level appeal systems; applying these rules to them would be wrong |
| Internal appeal, external/independent review, expedited review, right to the claim file and criteria | **Other 47 states** — each external-review statute differs; contributions welcome (`docs/adding-a-state.md`) |
| No Surprises Act balance-billing protections inferable from a claim/EOB | **Good Faith Estimate disputes** (uninsured/self-pay), **dental/vision/pharmacy-only** plans |
| CA (DMHC and CDI), NY (DFS), TX (TDI) overlays for insured plans | **Grandfathered plans**, **short-term plans**, **church plans** — exemptions not modelled; treat results as the general case |

Other limits, stated plainly:

- A rule is included only if its number could be confirmed from a primary source. Where it
  could not, the dataset states the federal floor instead (e.g. Texas's consumer window to
  request independent review is recorded as the federal four-month minimum).
- Some regulator sites block automated readers; in those cases `source_url` points to the
  statute on the legislature's site and the regulator page appears in `help-resources.json`.
- Deadlines are computed from an *anchor date* the consumer supplies (letter date, final
  internal denial date, service date). If the plan's letter states a *shorter* deadline than the
  legal minimum, the letter may be wrong — surface both; never silently pick one.
- Laws change. `last_verified` is the only freshness guarantee. If you ship this to people,
  run `validate.mjs` in CI so a stale dataset fails your build too.

## Contributing

- **Add a state**: `docs/adding-a-state.md` — read the statute, the utilization-review rules
  and the regulator page; add only what differs from the federal baseline; add the state's
  Consumer Assistance Program to `help-resources.json`; run `node validate.mjs`; open a PR with
  the URLs you actually read and the date.
- **Fix a rule**: cite the primary source in the PR. Corrections to a number or a deadline bump
  the minor version; new jurisdictions bump the minor version; field or semantics changes bump
  the major version.
- **Re-verify**: any PR that only updates `last_verified` after re-reading the source is
  welcome and is the most valuable kind.

## Provenance

Written by one person for LexHack 2026 (September 2026), every source read by hand from eCFR,
state legislature sites and regulator pages, with the reading date recorded. Extracted into this
repository during the Amazon Build, Ship, Shape Developer Hackathon (October 2026). AI coding
tools were used to write the validator and format the files; the legal content and every
`source_url` were read and recorded by a human.

## Citation

```
Overturn contributors. us-health-appeal-rules: machine-readable US health insurance appeal
rules (federal, No Surprises Act, CA, NY, TX). Version ⟦x.y.z⟧, 2026.
https://github.com/Chinorab/us-health-appeal-rules
```

## License

MIT — see `LICENSE`. The underlying statutes and regulations are public domain; the selection,
summaries, structure and verification records are what this license covers.
