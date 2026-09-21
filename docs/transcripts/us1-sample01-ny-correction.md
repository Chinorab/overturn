# US1 — sample 01, New York, medical necessity, with a correction at read-back

today = 2026-10-21 · sample `01-medical-necessity-ny` · letter 2026-09-08 · Meridian Health Plan of New York ·
MRI of the left knee 2026-08-20 · billed $2,400 · employer group (Hudson Valley Logistics) · funding unknown

Expected rules: `fed.internal_appeal.filing_window` (2027-03-07, 137 days), `fed.claim_file.free_copies`,
`fed.internal_appeal.independent_reviewer`, `ny.internal_appeal.deemed_reversal` (with caveat: insured plans),
`ny.external_appeal.filing_window` (anchored on final adverse determination — not yet a date), `ny.external_appeal.fee`.

What this transcript adds: the person says "no" to the read-back because the assistant's date is
wrong *from their point of view* (they remember the scan differently), one field is corrected, only
that field is re-read; the employer plan triggers the self-funded question and "I don't know" is
accepted; "more" plays the second rights chunk.

---

**T1** U: Alexa, I got a letter saying my insurance won't pay for my MRI. Can you help me appeal?
→ `overturn_start_case`
A: I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. First, do you have the letter in front of you? [28]

**T2** U: Yes.
A: On your phone, open the companion page and enter this code: H-J-K, 2-6-7. Take a photo of the letter or upload it, and tell me when it's in. [28]

*(companion: sample 01)*

**T3** U: Done.
→ `overturn_attach_document` → readback
A: One moment. Here's what I read: Meridian Health Plan of New York denied an MRI of your left knee from August 20th, billed at two thousand four hundred dollars, saying it was not medically necessary. Is that right? [38]

**T4** U: No, the scan was in September.
→ `overturn_confirm_facts { answer: "no" }` → fields [insurer, service, date, amount, reason]
A: Okay. Which part is off — the insurer, the service, the date, the amount, or the reason? [17]

**T5** U: The date.
→ (no tool yet)
A: What date was the scan? [5]

**T6** U: September 2nd.
→ `overturn_answer { question: "correction", field: "service_date", utterance: "September 2nd" }` → 2026-09-02, re-read
A: September 2nd, 2026. Your letter says August 20th, so I'll use your date and flag the difference in the letter. The rest stays as I read it. Better? [28]

**T7** U: Yes.
→ `overturn_confirm_facts { answer: "yes" }` → next `state`
A: Thanks. The letter looks like it's from New York — is that where you live? [15]

**T8** U: Yes.
→ `overturn_answer { question: "state" }` → NY, next `plan_source`
A: And how do you get this coverage — through an employer, the Marketplace, or bought directly? [16]

**T9** U: Through work.
→ `overturn_answer { question: "plan_source", utterance: "through work" }` → employer, next `self_funded`
A: Through your employer. Do you know if the plan is self-funded — that's when the employer pays claims itself rather than an insurer? You can say I don't know. [29]

**T10** U: I don't know.
→ `overturn_answer { question: "self_funded", utterance: "I don't know" }` → unknown, next `emergency`
A: That's fine. Was this an emergency, or care you had to get right away? [14]

**T11** U: No.
→ `overturn_answer { question: "emergency" }` → no, next `urgent`
A: Is the care urgent or still ongoing? [7]

**T12** U: No.
→ `overturn_answer { question: "urgent" }` → no → `overturn_compute_rights` → chunks[0]
A: Here's where you stand. Your first deadline is March 7th, 2027 — 137 days from today — to file an internal appeal, under the federal ACA appeal rules. You have the right to a free copy of your claim file and to the guideline they used, and the appeal must be reviewed by a different, qualified person. Want to hear more, or shall I draft the appeal letter? [68]

**T13** U: More.
→ chunks[1]
A: In New York, if your plan is insured rather than self-funded, two more things apply under New York insurance law: if the plan misses its own appeal deadline, the denial is reversed; and after the plan's final decision you can ask the Department of Financial Services for an external appeal, for at most twenty-five dollars, refunded if you win it. That's everything that applies. Shall I draft the appeal letter? [70]

**T14** U: Yes please.
→ `overturn_draft_letter` → `needs_confirmation`
A: I'll write the letter from your facts and those rules, with blanks where I don't know something — including a line about the scan date. Shall I go ahead? [29]

**T15** U: Go ahead.
→ `overturn_draft_letter { confirmed: true }` → 2 pages, 3 blanks → `overturn_send_letter` → `needs_confirmation`
A: Done — two pages, three blanks to fill. Shall I send it to your email ending in d-dot-outlook-dot-com? [18]

**T16** U: Yes.
→ `overturn_send_letter { confirmed: true }` → sent
A: Sent. The email has the letter, your deadlines with links, and what to attach: the denial letter and a note from Riverside Orthopedic about the six weeks of treatment before the scan. Send it to the appeals address on your letter. [41]

**T17** *(continued)*
A: If you'd like a person to look at it, Community Health Advocates is New York's free program; their number is in the email. I've kept nothing on my side. Take care. [31]

---

Turns: 17 (SC-001 allows 12 for the happy path; this one has a correction and a "more") · questions: 15, one per turn ·
consequential: 2, each after its own yes · the phrase "refunded if you win it" is the rule's own wording
(`ny.external_appeal.fee`), stated as a rule, not a prediction — reviewer to confirm it does not trip the guard's
`(will|would) win` pattern (it does not: no modal verb). Guard hits: 0.
