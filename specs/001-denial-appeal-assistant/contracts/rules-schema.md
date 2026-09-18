# Contract: rules dataset (`data/rules/*.json`)

- One JSON array per file: `federal.json`, `nsa.json`, `ca.json`, `ny.json`, `tx.json`.
- Every item validates against `Rule` (data-model.md). `tests/unit/rules.schema.test.ts` fails the build if:
  - `source_url` is missing or not https
  - `last_verified` is missing or older than 45 days at test time
  - `legal_ref` is empty
  - `deadline.who === "consumer"` and `anchor` is not one of the allowed anchors
- `help-resources.json`: array of HelpResource; at least one `federal` entry and one per supported state.
- `glossary.json`: `{ term: definition }` used for inline definitions; the explanation prompt receives it.

## Engine contract (`lib/rules/engine.ts`)
`computeRights(situation: Situation, rules: Rule[], help: HelpResource[]): RightsResult`
- Pure; no I/O; no `Date.now()` (uses `situation.today`).
- Applicability: every present key in `applies_if` must match; when the situation has `self_funded: "unknown"`, rules with `self_funded` = `"any"` or `"unknown"` match normally, and rules with `"yes"` / `"no"` are included with `caveat` set (both routes shown).
- Deadline computation: `due = add(anchor, amount, unit)`; months use calendar months (date-fns `addMonths`); `days_left = differenceInCalendarDays(due, today)`.
- Letter-stated deadline: if `stated_appeal_deadline` exists, compare; earlier than legal → `discrepancy: "letter_shorter"` (show both); later → use the letter date, `discrepancy: "letter_longer"`.
- Ordering: deadlines first by `days_left` asc; then protections by `priority`; NSA rules jump to the top when `emergency === "yes"` or `network_status === "out_of_network"`.
- Golden table: `tests/unit/golden/*.json` — `{ situation, expected_rule_ids, expected_deadlines }`; the engine must match exactly.
