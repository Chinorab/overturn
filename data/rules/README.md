# The rules dataset

Everything Overturn asserts about a right, protection, or deadline lives here, as data. The
language model never sees this folder; it only receives the rules the engine has already
selected for a given situation, and it can only cite those.

## Files

| File | Scope |
|---|---|
| `federal.json` | ACA / ERISA claims-and-appeals baseline (applies to every job-based, Marketplace, and individual plan) |
| `nsa.json` | No Surprises Act protections (emergency care, out-of-network providers at in-network facilities) |
| `ca.json`, `ny.json`, `tx.json` | State overlays for plans regulated by that state |
| `../help-resources.json` | Free human help: consumer assistance programs, regulators, help desks |
| `../glossary.json` | Plain-English definitions the explanation prompt may reuse |

## One rule

```json
{
  "id": "ny.external_appeal.filing_window",
  "jurisdiction": "NY",
  "category": "deadline",
  "title": "New York: 4 months to file an external appeal with DFS",
  "summary": "Plain English, 60 words or fewer.",
  "legal_ref": "N.Y. Ins. Law § 4914; DFS External Appeal program",
  "source_url": "https://www.dfs.ny.gov/ExternalAppeal/",
  "last_verified": "2026-09-18",
  "applies_if": { "state": ["NY"], "self_funded": "no", "denial_category": ["medical_necessity", "experimental"] },
  "deadline": { "anchor": "final_internal_denial_date", "amount": 4, "unit": "months", "who": "consumer" },
  "priority": 12,
  "why_template": "One sentence, true whether or not funding is known.",
  "caveat": "Optional; shown when it applies."
}
```

- `applies_if` keys are ANDed. Omitted keys match anything. `self_funded: "no"` means *insured
  plans only* (state law reaches them; ERISA self-funded plans are federal-only). When the user
  answers "I don't know", such rules are still shown, with a caveat.
- `deadline.who === "consumer"` rules get a clock in the interface; `"insurer"` windows are
  informational.
- `priority` orders rules within a screen (lower first). No Surprises Act rules use 1–6 so they
  lead when they apply.

## Adding a state (about half a day)

1. Read the primary sources: the state's external-review statute, its utilization-review
   appeal rules, and the regulator's consumer page. Record the URL you actually read.
2. Create `data/rules/xx.json` with the rules that *differ from or add to* the federal
   baseline. Do not restate federal rules; they already apply.
3. Add the state's Consumer Assistance Program and regulator to `../help-resources.json`.
4. Register the file in `lib/rules/load.ts` and add `"XX"` to `SUPPORTED_STATES` in
   `lib/schemas/core.ts`.
5. Add at least one row per plan-funding case to the golden table in
   `tests/unit/rules.engine.test.ts`.
6. Run `pnpm test`. The schema test will refuse any rule without an `https` source, a
   `legal_ref`, or a `last_verified` date within 45 days.

## Keeping it honest

- `last_verified` is a promise that a human read the source on that date. The schema test
  fails the build when a rule is more than 45 days stale, so the dataset cannot silently rot.
- When a source cannot be fetched (some regulator sites block automated readers), the rule
  cites the statute on the legislature's site and the regulator page is used for the human
  help entry instead.
- If a number could not be confirmed from a primary source, it is not in the dataset. For
  Texas, for example, the consumer's window to request independent review is stated only as
  the federal four-month floor that every state process must meet.
