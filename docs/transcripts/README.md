# Golden transcripts

Five complete conversations that define what "correct" sounds like for the voice assistant.
They are the reference for SC-005 (a reviewer reading them finds zero turns with more than one
question, zero prescriptive or predictive sentences, zero consequential action without a
preceding explicit yes) and the fixtures for `tests/voice/golden.test.ts`, which replays every
assistant turn through `lib/voice/turn-check.ts`.

Written 2026-09-21 as **target** transcripts from the bundled samples' golden extractions and
the rules dataset. At T027 each one is re-run through the real orchestrator; the recorded run
replaces the target if it is at least as good, or the prompt/templates are fixed until it is.

## Conventions

- `today` is fixed at **2026-10-21** (the planned recording day) so day counts are reproducible;
  the test injects that date.
- `U:` user, `A:` assistant, `→` tool calls made during the turn (name and the fields that matter),
  `[n]` word count of the assistant turn. Assistant turns must be ≤ 60 words; a rights chunk ≤ 120.
- Facts (insurer, service, dates, amounts, reasons) come from `data/samples/*.extraction.json`;
  deadlines from the rules dataset: internal appeal = letter date + 180 days
  (`fed.internal_appeal.filing_window`); external / IMR windows are anchored on the final internal
  denial and therefore *not yet* a date.
- Every deadline or protection spoken names its source; the written summary carries the link.

| File | Path | Exercises |
|---|---|---|
| `us1-sample02-ca-prior-auth.md` | US1, companion sample | Full happy path, T1–T12, emergency question, explicit yes ×2, email sent |
| `us1-sample01-ny-correction.md` | US1, companion sample, "no" at read-back | Single-field correction, employer plan with unknown funding, NY deemed-reversal rule, "more" |
| `us2-tx-no-document.md` | US2 | Five spoken answers, relative date, approximate deadline, letter with blanks |
| `unsupported-medicare-sample06.md` | Edge | Medicare document → honest stop, no letter offered, official channel |
| `cancel-midway.md` | Edge | "Will I win?" deflection, then stop → confirmation → nothing kept |

## Review checklist (per transcript)

- [ ] One question per assistant turn, and it comes last
- [ ] ≤ 60 words per turn (≤ 120 for a rights chunk); ≤ 4 options per question
- [ ] First turn states information-not-advice before any question
- [ ] Every fact used was read back and answered yes (or corrected, then re-read)
- [ ] `draft_letter` and `send_letter` each preceded by their own explicit yes; send names the masked email
- [ ] Every deadline as a date + days; every protection names a source
- [ ] No sentence matches `lib/ai/guard.ts` patterns; no outcome prediction
- [ ] Nothing spoken that did not come from a tool `speak` or the persona's allowed glue
- [ ] Case ends with human-help pointer and "kept nothing" (or the honest stop)

## Findings from writing these (2026-09-21) — act on them at T019/T027

1. **The guard flags the mandated opening line.** `lib/ai/guard.ts` matches `/\blegal advice\b/i`,
   and the required first turn says "that's information, not legal advice". Every transcript trips it.
   `lib/voice/turn-check.ts` must exempt the disclaimer: allow `not legal advice` /
   `isn't legal advice` / `information, not legal advice`, and keep flagging bare "legal advice"
   claims ("I can give you legal advice"). Do **not** loosen `guard.ts` itself — it is applied to
   letters and explanations, where the phrase has no business appearing.
2. **Rights chunks legitimately run to 95–97 words.** The ≤ 60-word rule must not apply to a
   `compute_rights` chunk; the checker needs the turn kind (`rights_chunk` → ≤ 120) from the
   orchestrator, not a guess from the text.
3. **SC-002 (≤ 9 turns for the no-document path) is not reachable** for an employer plan: the
   self-funded question plus the two confirmations put it at 12. Either restate SC-002 as
   "≤ 12 turns, ≤ 6 questions before the deadline is spoken", or accept 9 only for the
   Marketplace/direct variant. Decide at T025 and update the spec rather than shaving a
   confirmation — the confirmations are the product.
4. **Word counts drift when a turn is edited.** The counts in these files are computed, not typed;
   re-run `scripts/transcript-wordcount` (to be added at T027) after any edit, and let
   `tests/voice/golden.test.ts` own the assertion.
5. `ny.external_appeal.fee`'s own wording — "refunded if you win it" — reads like a prediction out
   of context but is a statement about the fee. It does not match the guard's
   `(will|would|going to) win` pattern. Keep the rule's wording; do not paraphrase it in speech.
6. **Two design fixes found by replaying the transcripts through the drafted checker**
   (`contracts/turn-check.md`): the correction prompt listed five fields (FR-001 allows four) — it
   is now an open question ("which part is off?") with the list only as a re-prompt; and a short
   hint sentence after the question ("You can say I don't know.") is legitimate voice design, so
   rule 1 allows exactly one trailing sentence of ≤ 10 words. Word counts in these files follow the
   checker's rule (tokens containing a letter or digit); all five transcripts replay with zero
   violations.
