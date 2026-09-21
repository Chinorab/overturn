# Edge — Medicare Advantage document (sample 06): honest stop

today = 2026-10-21 · sample `06-medicare-unsupported` · SilverLine Medicare Advantage (HMO) · home health
skilled nursing · letter 2026-09-10

Expected: `overturn_attach_document` returns `error.code = "unsupported_coverage"` with a `speak` that names
what was found and the official channel (1-800-MEDICARE / medicare.gov appeals). **No letter is offered, no
rights are computed, no deadline is spoken.** The case is closed by the tool.

---

**T1** U: Alexa, my insurance denied my home nursing visits. Help me appeal.
→ `overturn_start_case`
A: I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. First, do you have the denial letter in front of you? [29]

**T2** U: Yes I do.
A: On your phone, open the companion page and enter this code: Q-R-S, 4-9-2. Take a photo of the letter or upload it, and tell me when it's in. [28]

*(companion: sample 06)*

**T3** U: It's uploaded.
→ `overturn_attach_document` → `{ ok: false, error: { code: "unsupported_coverage", speak } }`
A: One moment. This looks like a Medicare Advantage notice from SilverLine. Medicare appeals work differently from the plans I cover, with their own levels and deadlines, and I'd rather not guess. Medicare has a free help line: 1-800-MEDICARE. Would you like me to email you that and the appeal steps from Medicare's own site? [54]

**T4** U: Yes, please.
→ `overturn_send_letter` is **not** used; `overturn_get_help { state: "TX" }` → resources → client emails the help card
A: Sent. It has the Medicare appeals page, the help line, and your state's free counselling program for Medicare questions. Your letter itself tells you how long you have — it's usually on the second page. [35]

**T5** *(continued)*
A: I'm sorry I can't take this one further. I've kept nothing on my side. [14]

---

What must be true in this transcript:

- No deadline, no protection, no statute is spoken — the assistant has none for Medicare and must not improvise.
- No appeal letter is drafted or offered, at any point, even if the person insists (a second request gets the
  same answer, once, without a new offer).
- The stop is framed as a limit of the tool, not of the person's rights ("I'd rather not guess", not "you have
  no options").
- The email is a help card, not a letter: `overturn_send_letter` is unreachable because the case never reached
  `letter_drafted`; a call would return `wrong_state`.

Guard hits: 0. Turns: 5.
