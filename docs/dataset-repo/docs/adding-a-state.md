# Adding a state

About half a day for someone comfortable reading a statute. You will read three or four primary
sources, write five to eight rules that *add to or differ from* the federal baseline, add the
state's free-help entries, run the validator, and open a pull request that shows your sources.

The federal rules in `rules/federal.json` already apply everywhere (ACA §2719 internal and
external review, ERISA claims procedure). A state overlay only says what the state does *on top*
— usually a longer window, a faster clock, a free independent review, a named regulator. **Do not
restate federal rules in a state file.**

## 0. Before you start: which plans a state can reach

State insurance law applies to **insured** plans (the employer or the person buys a policy from
an insurer licensed in the state) and to Marketplace/individual plans. It does **not** apply to
**self-funded** employer plans, which are governed by ERISA and get only the federal rules. Every
state rule therefore carries `"self_funded": "no"` in `applies_if`. Overturn still shows these
rules to people who don't know how their plan is funded, with the rule's `caveat` — write the
caveat with that reader in mind.

Some states have two regulators (California: DMHC for HMOs and most PPOs, CDI for the rest). If
yours does, add a `process` rule that tells the person how to find out which one, as
`ca.regulator.which_one` does.

## 1. Read the primary sources (60–90 min)

Find and read, in this order, recording the URL you actually opened and today's date:

| Source | What to extract |
|---|---|
| The state's **external review / independent review statute** (insurance code) | Consumer filing window and its anchor (final internal denial? notice date?), who may file, fee (if any) and refund conditions, standard and expedited decision windows, whether the decision binds the plan, what is reviewable (medical necessity only? experimental? out-of-network emergencies?) |
| The state's **utilization review / internal appeal rules** (statute or regulation) | The plan's decision deadlines for standard and urgent appeals, any "deemed reversal" if the plan misses its clock, written-reasons requirements |
| The **regulator's consumer page** on appeals | Confirms the numbers above in plain language; gives the phone number and complaint route; sometimes states a shorter *practical* deadline than the statute — note it, don't adopt it |
| The state's **Consumer Assistance Program** (CAP) page, if the state has one | Name, phone, URL, what they do. CMS keeps a list of CAPs; some states have none — then the regulator's help line is the entry |

Prefer, in this order: the legislature's official statute site (or a stable mirror like
`*.public.law` when the official site blocks automated readers) → the regulator's official page →
nothing else. No secondary sources (law-firm blogs, insurer FAQs, Wikipedia) as `source_url`.

If a number cannot be confirmed from a primary source, **leave it out**. Where the state process
must meet a federal floor (external review filing window ≥ 4 months, expedited decision ≤ 72 h),
you may record the federal floor and say so in the `caveat` — that is how Texas's consumer window
is recorded.

## 2. Write `rules/xx.json` (60–90 min)

One JSON array. Typical set for a state, in `priority` order (lower first, 10–60 leaves room):

| # | `category` | What it says | Example id |
|---|---|---|---|
| 1 | `deadline` | Consumer window to request external/independent review, with `deadline` block (`who: "consumer"`) | `ny.external_appeal.filing_window` |
| 2 | `protection` | What the external review covers and that its decision binds the plan | `ny.external_appeal.scope` |
| 3 | `process` | Fee and refund, or "free" (`protection` if it is a right to a free review) | `ny.external_appeal.fee`, `ca.imr.free` |
| 4 | `process` | Standard and expedited external decision windows | `ca.imr.decision_windows` |
| 5 | `process` | The plan's internal appeal decision clock (`deadline` block with `who: "insurer"` if you want it shown as a date) | `tx.internal_appeal.decision_30_days` |
| 6 | `protection` | Deemed reversal / automatic approval if the plan misses its clock, where the state has it | `ny.internal_appeal.deemed_reversal` |
| 7 | `right` | Written reasons, clinical criteria on request, when the state adds to the federal right | `ca.grievance.written_reasons` |
| 8 | `process` | Which regulator, when there are two | `ca.regulator.which_one` |

Field by field:

- `id`: `xx.topic.detail`, lowercase, dots and underscores only. Never reuse a removed id.
- `jurisdiction`: the two-letter state code. Also add it to the `Jurisdiction` enum in
  `schema.json` (the validator will tell you).
- `title`: starts with the state name, states the fact, ≤ 12 words. *"Texas: the plan must decide
  your appeal within 30 calendar days"*.
- `summary`: ≤ 60 words, Grade 8, no "you should". Describe what the rule says, in the second
  person where natural. It may be spoken aloud by an assistant — read it out once.
- `legal_ref`: as a lawyer cites it. *"N.Y. Ins. Law § 4914"*, *"Cal. Health & Safety Code § 1374.30"*.
- `source_url`: the page you read. `https` only.
- `last_verified`: today, ISO `YYYY-MM-DD`.
- `applies_if`: `state: ["XX"]`, `self_funded: "no"`, and the narrowest honest
  `denial_category` list (external review usually covers `medical_necessity`, `experimental`,
  sometimes `prior_auth` and out-of-network emergencies; check the statute's scope clause).
  Add `urgent: true` for expedited-only rules.
- `deadline` (only when a real clock exists): `anchor` is what the statute counts from —
  `final_internal_denial_date` for external review, `letter_date` for a first-level appeal,
  `service_date` rarely. `unit` in the statute's own unit (`months` stays months; don't convert
  to days). `who: "consumer"` gives the person a countdown; `"insurer"` is informational.
- `priority`: integer; NSA rules use 1–6, so start state rules at 10.
- `why_template`: one sentence, true whether or not funding is known. *"Because your plan is
  regulated by New York, you can ask DFS for an external appeal after the internal appeal."*
- `caveat`: what a person with an unknown or self-funded plan should know. *"Applies to insured
  plans. If your employer plan is self-funded, the federal external review process applies instead."*

Copy `rules/ny.json` as a starting point — it is the smallest complete overlay.

## 3. Add free help to `help-resources.json` (15 min)

At least two entries with `scope: "XX"`: the Consumer Assistance Program (`kind: "CAP"`) if the
state has one, and the regulator (`kind: "regulator"`). Fields: `id` (`xx.short`), `name`, `kind`
(`CAP` · `regulator` · `ombudsman` · `helpdesk`), `phone` (optional, as printed on the page), `url`
(`https`), `what_they_do` (one or two sentences; what a caller can expect).

## 4. Validate (5 min)

```bash
node validate.mjs
```

It checks: JSON Schema (`schema.json`), every `source_url` is `https`, every `last_verified` is
within 45 days, ids are unique across files, `jurisdiction` matches the file name, every
`applies_if.state` value is in the enum, and every state present in `rules/` has at least one
`help-resources.json` entry. Fix until it exits 0.

Then sanity-read your rules as a person would hear them: for each rule, read `summary` aloud
and ask *"is this true as stated, for an insured plan, in this state, today?"*

## 5. Open the pull request

Title: `Add <State> overlay (<n> rules)`. In the description:

- the list of URLs you read, each with the date;
- the numbers you could **not** confirm and left out;
- anything unusual (two regulators, a state with no CAP, a window shorter than the federal floor
  — which would be a finding worth flagging, since the federal floor should win).

Bump `VERSION` minor (`1.1.0` → `1.2.0`) and add a `CHANGELOG.md` entry:
`- 1.2.0 (YYYY-MM-DD): add XX overlay (n rules), help resources for XX.`

## 6. Keeping it alive

A rule is only as good as its `last_verified`. If you can re-read your sources every month or so
and update the dates (or fix what changed), say so in the PR; the maintainers will list you as the
contact for that state. Re-verification PRs with no content change are welcome and quick to merge.

## What not to do

- Don't infer a state rule from another state's, from a summary site, or from a model's answer.
- Don't add Medicare, Medicaid, CHIP, TRICARE, VA, dental, vision, pharmacy-only or Good Faith
  Estimate rules — different systems, out of scope by design.
- Don't write "you should", "you must", "you will win". The dataset informs; it does not advise.
- Don't restate the federal baseline in a state file.
