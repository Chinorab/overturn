# Extraction eval

Measures how well Overturn reads a denial letter or an Explanation of Benefits, on documents
whose right answer is known **by construction**: the generator draws every fact first (insurer,
amounts, dates, codes, deadline, state…), then writes the document around those facts. No model
ever labels a case, so the score cannot inherit a model's mistakes.

```
eval/
  cases/            60 synthetic documents: <id>.source.json + <id>.truth.json (committed)
                    and <id>.pdf (rendered locally, not committed)
  cases-adapted/    the same cases reworded by Adaption Labs, same truth (after an import)
  adaption/         blocks.csv / blocks.jsonl to upload, rejected.txt after an import
  results/          one cached extraction per case and per model (re-scoring is free)
  reports/          <date>-<provider>-<model>.md and .json
```

## Run it

```bash
pnpm eval:generate              # write eval/cases (deterministic, seed 20261016)
pnpm gen:samples eval/cases     # render them to PDF
pnpm eval:run                   # dry run: case count and estimated cost, nothing sent
pnpm eval:run --yes --limit 12  # spend on the first 12 (one full rotation of the traps)
pnpm eval:run --yes             # spend on everything not cached yet
pnpm eval:run --score-only      # rescore cached results, no API call
```

The model is the app's own setting: `OVERTURN_MODEL` (default `claude-opus-5`). Set it for one
run to compare models; each model caches in its own folder of `results/`.

Estimated cost for the 60 cases, from the Claude API price list (October 2026):

| Model | Per document | 60 documents |
|---|---|---|
| `claude-opus-5` (the app today) | ~$0.065 | ~$3.90 |
| `claude-opus-5-5` | ~$0.052 | ~$3.12 |
| `claude-sonnet-5-5` | ~$0.026 | ~$1.56 |
| `claude-haiku-5-5` | ~$0.001 | ~$0.08 |

## What is scored

Every field gets one of four verdicts, because they are four different failures for the person
reading the result:

| Verdict | Meaning |
|---|---|
| correct | the value matches, or both agree the document does not say it |
| miss | the document says it; the extraction left it empty |
| **hallucination** | the document does not say it; the extraction filled it anyway |
| wrong | both filled, with different values |

Hallucinations are reported apart: they are what the product is built to prevent. The report
also checks Overturn's other promise, that every fact shows the sentence it came from: a quote
counts as found when at least 80% of its words are on the page.

### Traps

Each case carries planted traps, each aimed at one known way to misread a denial:

| Trap | Targets | What a correct reading does |
|---|---|---|
| `boilerplate_expedited` | urgency | the generic "you may ask for an expedited appeal" sentence is **not** an urgent case |
| `urgent_case` | urgency | an expedited concurrent review during an inpatient stay **is** one |
| `vague_owed` | amount you may owe | "the provider may bill you", with no figure, leaves the amount empty |
| `no_letter_date` | letter date | a document with no date gets no date |
| `deadline_as_date` | appeal deadline | "must be received by March 7, 2027" is a date, not a number of days |
| `short_deadline` | appeal deadline | a 60-day window is read as 60, not the usual 180 |
| `no_deadline` | appeal deadline | no window stated, none invented |
| `medicare_advantage` / `medicaid_managed_care` | program | a government program is recognised (Overturn then stops honestly) |
| `emergency_visit` | emergency | an emergency department visit is flagged |
| `insurer_out_of_state` | state | the state comes from the member's address, not the insurer's |
| `us_date_format` | service date | 08/20/2026 is read as 2026-08-20 |

## More varied wording with Adaption Labs

The generated letters reuse a small set of sentences. Adaption Labs' **Adaptive Data** can
rewrite them so they read like many different insurers, while the facts stay fixed.

1. `pnpm eval:adaption export` writes `eval/adaption/blocks.csv` (245 blocks of prose, each with
   a `must_keep` column listing the exact facts it carries).
2. Upload `blocks.csv` to Adaptive Data and give it this brief:

   > Rewrite the `text` column so each block reads as if a different US health insurer wrote it:
   > vary sentence order, vocabulary and tone (formal, plain, terse). Every string listed in
   > `must_keep` must appear exactly as written, with the same characters and formatting. Do not
   > add any amount, date, code, phone number, or number of days that is not already in the text.
   > Do not add or remove any mention of Medicare, Medicaid, emergency, urgent, expedited,
   > inpatient, or out-of-network. The meaning must stay identical. Put the result in a new
   > column named `rewritten`; keep the `id` and `block` columns unchanged.

3. Download the result (CSV or JSONL) and import it:

   ```bash
   pnpm eval:adaption import path/to/result.csv     # --column <name> if it is not "rewritten"
   pnpm gen:samples eval/cases-adapted
   pnpm eval:run --cases eval/cases-adapted          # dry run first, then --yes
   ```

   The import accepts a rewrite only if it kept every fact and added none (no new amount, date,
   code or signal word). Anything else is rejected and listed in `eval/adaption/rejected.txt`;
   the case keeps its original wording for that block. The ground truth is copied unchanged.

Comparing the score on `cases/` and `cases-adapted/` shows whether the extraction depends on
the exact phrasing it happened to be tested on.

All names, plans, identifiers and addresses in these documents are fictional, and every PDF
carries a "SAMPLE - FICTIONAL DOCUMENT" watermark.
