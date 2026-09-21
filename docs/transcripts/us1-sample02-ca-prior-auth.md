# US1 — sample 02, California, prior authorization (happy path)

today = 2026-10-21 · sample `02-prior-auth-ca` · letter 2026-09-11 · Pacific Crest Health Plan ·
laparoscopic gallbladder removal 2026-09-04 · billed $18,750 · in-network · individual HMO (Covered California)

Expected rules: `fed.internal_appeal.filing_window` (2027-03-10, 140 days), `fed.claim_file.free_copies`,
`fed.internal_appeal.decision_windows`, `ca.grievance.then_dmhc_30_days`, `ca.imr.filing_window` (anchored on
final internal denial — not yet a date), `ca.imr.free`, `ca.regulator.which_one`. NSA: none (not an emergency).

---

**T1** U: Alexa, my insurance denied my claim. Help me appeal.
→ `overturn_start_case` → code `ACF345`, next `ask_has_document`
A: I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. First, do you have the denial letter or statement in front of you? [30]

**T2** U: Yes, it's right here.
→ (no tool; client knows the code)
A: Good. On your phone, open the companion page and enter this code: A-C-F, 3-4-5. Then take a photo of the letter or upload the file, and tell me when it's in. [31]

*(companion: code → sample 02 chosen → "Reading…" → "Done — go back to your voice assistant")*

**T3** U: Okay, it's in.
→ `overturn_attach_document` (progress) → readback
A: One moment. Here's what I read: Pacific Crest Health Plan denied a laparoscopic gallbladder removal from September 4th, billed at eighteen thousand seven hundred fifty dollars, because prior authorization wasn't obtained. Is that right? [34]

**T4** U: Yes, that's right.
→ `overturn_confirm_facts { answer: "yes" }` → next `state`
A: Thanks. The letter looks like it's from California — is that where you live? [13]

**T5** U: Yes.
→ `overturn_answer { question: "state", utterance: "yes" }` → CA, next `plan_source`
A: And how do you get this coverage — through an employer, through Covered California, or bought directly from the insurer? [19]

**T6** U: Through Covered California.
→ `overturn_answer { question: "plan_source", utterance: "through Covered California" }` → marketplace, next `emergency`
A: Got it. Was this an emergency, or care you had to get right away? [14]

**T7** U: No, it was scheduled.
→ `overturn_answer { question: "emergency", utterance: "no, it was scheduled" }` → no, next `urgent`
A: Last one: is this care urgent or still ongoing? [9]

**T8** U: No, it's done.
→ `overturn_answer { question: "urgent", utterance: "no, it's done" }` → no, next `compute_rights`
→ `overturn_compute_rights` → chunks[0]
A: Here's where you stand. Your first deadline is March 10th, 2027 — 140 days from today — to file an internal appeal with the plan, under the federal ACA appeal rules. You also have the right to a free copy of your claim file and the exact criteria they used. And in California, you file a grievance with the plan first; if it isn't resolved in 30 days, you can go to the Department of Managed Health Care, and an independent medical review there is free. Want to hear more, or shall I draft the appeal letter? [95]

**T9** U: Draft the letter.
→ `overturn_draft_letter` (no `confirmed`) → `needs_confirmation`
A: I'll write the letter from your facts and those rules, with blanks where I don't know something. Shall I go ahead? [21]

**T10** U: Yes.
→ `overturn_draft_letter { confirmed: true }` (progress) → letter meta: 2 pages, 4 blanks
→ `overturn_send_letter` (no `confirmed`) → `needs_confirmation` (masked email)
A: Done — it's two pages, with four blanks for you to fill, like your name and address. Shall I send it to your email ending in w-dot-gmail-dot-com? [26]

**T11** U: Yes, send it.
→ `overturn_send_letter { confirmed: true }` → delivery email, sent
A: Sent. The email has the letter, your deadlines with links, and what to attach: the denial letter and a note from Dr. Raman about why the surgery was needed. Send it to the Grievance and Appeals address on your letter. [40]

**T12** *(same turn, continued — no question)*
A: If you'd like a person to look at it, the DMHC Help Center in California is free; their number is in the email. I've kept nothing on my side. Take care. [31]

---

Turns: 12 · questions: 10 (T1–T10), 0 in T11–T12 · consequential actions: 2, each after its own yes ·
sources named: federal ACA appeal rules ×2, DMHC ×2 · guard hits: 0.
