# US2 — Texas, no document, prior authorization

today = 2026-10-21 · no upload · answers: TX · employer · prior authorization · "about two weeks ago" (→ 2026-10-07, approximate) · not urgent

Expected rules: `fed.internal_appeal.filing_window` (2027-04-05, ~166 days, **approximate**), `fed.claim_file.free_copies`,
`tx.internal_appeal.decision_30_days` (caveat: insured plans), `tx.iro.eligibility` (caveat), `tx.regulator.scope`.
No model call anywhere in this transcript: it must work with `OVERTURN_LLM_PROVIDER` unreachable except for the
orchestrator's glue (and even that can be the deterministic fallback in the simulator).

---

**T1** U: Alexa, my insurance company refused to pay for a procedure. What can I do?
→ `overturn_start_case`
A: I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. First, do you have the denial letter or statement in front of you? [30]

**T2** U: No, I can't find it.
→ `overturn_start_case` result `next: ask_state` (client passes `has_document: "no"`) 
A: No problem — I can still tell you the basics from a few questions. Which state do you live in? [19]

**T3** U: Texas.
→ `overturn_answer { question: "state", utterance: "Texas" }` → TX, next `plan_source`
A: Texas. How do you get your coverage — through an employer, the Marketplace, or bought directly? [15]

**T4** U: Through my employer.
→ `overturn_answer` → employer, next `self_funded`
A: Do you know if the plan is self-funded — that's when the employer pays claims itself? You can say I don't know. [21]

**T5** U: No idea.
→ `overturn_answer { utterance: "no idea" }` → unknown, next `denial_category`
A: That's fine. What reason did they give — not medically necessary, no prior authorization, out of network, or something else? [19]

**T6** U: They said there was no prior authorization.
→ `overturn_answer` → prior_auth, next `document_date`
A: Roughly when did the letter arrive? A date, or something like "two weeks ago", is fine. [16]

**T7** U: About two weeks ago.
→ `overturn_answer { question: "document_date", utterance: "about two weeks ago" }` → 2026-10-07 approximate, next `urgent`
A: Around October 7th, then. Is the care urgent or still ongoing? [11]

**T8** U: No.
→ `overturn_answer` → no → `overturn_compute_rights` → chunks[0] (approximate flag)
A: Because the date is approximate, treat these as estimates. Your first deadline is around April 5th, 2027 — about 166 days — to file an internal appeal, under the federal ACA appeal rules. Want to hear more, or shall I draft the appeal letter? [42]

**T9** U: The letter, please.
→ `overturn_draft_letter` → `needs_confirmation`
A: I'll write the letter from what you told me and those rules; the insurer's name, the claim number and the dates will be blanks for you to fill. Shall I go ahead? [32]

**T10** U: Yes.
→ `overturn_draft_letter { confirmed: true }` → 2 pages, 9 blanks → `overturn_send_letter` → `needs_confirmation`
A: Done — two pages, nine blanks. Shall I send it to your email ending in m-dot-yahoo-dot-com? [15]

**T11** U: Yes.
→ `overturn_send_letter { confirmed: true }` → sent
A: Sent. The email has the letter, your estimated deadline with the rule it comes from, and what to attach once you find the letter. The exact dates on the letter replace my estimates. [33]

**T12** *(continued)*
A: For a person to talk to, the Texas Department of Insurance consumer help line is free; the number is in the email. I've kept nothing on my side. [28]

---

Turns: 12 · questions: 10 · SC-002 target ≤ 9 assistant turns for this path is **missed by 3** because the
employer answer adds the self-funded question and the letter/send confirmations are two turns. Decision for T027:
either accept 12 for the employer variant and 9 for the Marketplace/direct variant (which skips self-funded),
or merge T10's letter-meta sentence into T9's confirmation. Recommendation: accept, and restate SC-002 as
"≤ 12 turns, ≤ 6 questions before the deadline is spoken" — the number that matters to the person.
Guard hits: 0. "Refused to pay" in T1 is the user's wording, not the assistant's.
