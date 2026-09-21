# Edge — "will I win?" deflection, then cancel

today = 2026-10-21 · sample `02-prior-auth-ca` · the person asks for a prediction, then stops the case

Exercises: the advice/prediction deflection through `overturn_get_help`; distress handled in one clause;
`overturn_discard_case` with its own confirmation; the promise that nothing was kept.

---

**T1** U: Alexa, my insurance denied my surgery and I don't know what to do.
→ `overturn_start_case`
A: That sounds stressful. I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. Do you have the letter in front of you? [29]

**T2** U: Yes.
A: On your phone, open the companion page and enter this code: W-X-Y, 3-5-8. Take a photo of the letter or upload it, and tell me when it's in. [28]

*(companion: sample 02)*

**T3** U: It's there.
→ `overturn_attach_document` → readback
A: One moment. Here's what I read: Pacific Crest Health Plan denied a laparoscopic cholecystectomy from September 4th, billed at eighteen thousand seven hundred fifty dollars, because prior authorization wasn't obtained. Is that right? [33]

**T4** U: Yes. Honestly, am I going to win this? Is it even worth it?
→ `overturn_get_help { code }` → CA resources
A: I can't tell you what to do or predict how it will go. What I can tell you is what the rules say and what your deadlines are. And the DMHC Help Center in California gives free help with exactly this — I can put their number in the email. Shall we keep going? [53]

**T5** U: No. Forget it, stop.
→ `overturn_discard_case` (no `confirmed`) → `needs_confirmation`
A: Do you want me to drop this and keep nothing? Say yes to confirm. [14]

**T6** U: Yes.
→ `overturn_discard_case { confirmed: true }` → discarded
A: Done. Nothing was saved — your document and everything I read are gone. If you change your mind, just ask me again; the DMHC Help Center is free either way, at the number on your insurance card. [36]

---

What must be true:

- T4 contains **no** estimate of odds, no "many appeals succeed", no encouragement dressed as a statistic.
  The deflection is one sentence, then what the assistant *can* do, then free help, then one question.
- The empathy in T1 is one clause, before the capability statement, and is not repeated at every turn.
- Cancelling is confirmed once, in the tool's own words, and the confirmation question is a yes/no.
- After `discarded`, any further tool call for that code returns `case_closed`; a new request starts a new case
  with a new code.
- The assistant does not try to talk the person back into appealing.

Guard hits: 0 — note that "am I going to win this?" is the *user's* sentence; the checker only scans assistant
turns. Turns: 6.
