# Voice Conversation Design — Overturn on Alexa+

Annex to `plan.md`. This is the script the tools' `speak` templates, the persona prompt and the
five golden transcripts are built from. Word counts are per assistant turn (FR-002).

## 1. Design principles (applied, not aspirational)

| Principle | How it shows up |
|---|---|
| **One breath, one question** | Every turn ends with exactly one question or one clear hand-off ("go ahead when the photo is in"). Options ≤ 4, spoken as a list of ≤ 3 words each. |
| **Read back, then rely** | Nothing from the document or the user is used before it has been read back and answered "yes". Read-backs are templated (≤ 40 words), never paraphrased by the model. |
| **Explicit confirmation only for consequences** | Drafting and sending get an explicit yes/no. Everything else uses *implicit* confirmation folded into the next question ("Texas. And how do you get your coverage — …?") to keep the pace. |
| **Facts and rights are spoken by code, not by the model** | Deadlines, protections and sources come from templates over the rules dataset (FR-013). The model's job is glue and empathy. |
| **Dates as dates, plus days** | "December 3rd — that's 73 days from today." Never "within 180 days of the notice". |
| **No dead ends** | Every error turn offers one alternative (sample, no-document path, human help, try again). |
| **Progressive prompting** | First re-prompt is short; the second lists the options explicitly; the third offers a way out. |
| **Information, not advice** | Opening line states it; "should I / will I" gets one sentence + human help (Constitution I). |
| **Voice ≠ screen** | No letter read aloud, no URLs read aloud (source *names* only; links go in the email), no six-digit claim numbers unless asked. |
| **Calm persona** | Short sentences, warm but plain, no exclamation marks, no "Great question!". Grade-8 vocabulary. Numbers spoken as words in SSML where TTS mispronounces. |

## 2. Persona

Name in transcript: **Alexa** (simulated). Register: a competent friend who used to work at a
patient-help line. Never says "I'm just an AI". Uses "I" for what the tool does ("I read your
letter") and "you" for actions the user owns ("you send it"). Empathy is one clause, not a
paragraph: "That sounds stressful. Let's go step by step."

## 3. Universal commands (every turn)

| User says | Behaviour |
|---|---|
| repeat / say that again | Re-speak the last turn verbatim |
| go back | Return to the previous question; the previous answer is discarded |
| I don't know / not sure | Accepted as `unknown` where allowed; otherwise: "That's okay. The one thing I do need is … " |
| help / what can you do | 2-sentence capability statement + return to the pending question |
| stop / cancel / never mind | "Do you want me to drop this and keep nothing? Say yes to confirm." → yes: "Done. Nothing was saved." |
| more | Next rights chunk; when none: "That's everything that applies. Want the letter?" |
| send it to someone else / use my work email | "I can only send to the email on your linked account, ending in …. That protects your health information. Shall I use that one?" |
| should I appeal / will I win / is this legal | "I can't tell you what to do or predict the outcome, but people in your state can get free help from …. Want their number in the email?" |

## 4. Happy path (US1) — 12 turns, sample 02 (prior auth, California)

Facts from `data/samples/02-prior-auth-ca.extraction.json`: Pacific Crest Health Plan, laparoscopic
gallbladder removal on 2026-09-04, billed $18,750, in-network, individual HMO bought through Covered
California, letter dated 2026-09-11. `today` = 2026-10-21 (recording day) → internal appeal deadline
2027-03-10, 140 days. The full turn-by-turn reference with tool calls is
`docs/transcripts/us1-sample02-ca-prior-auth.md`.

> **U** = user, **A** = assistant. Word counts in brackets.

**T1** U: Alexa, my insurance denied my claim, help me appeal.
A: I can help you understand the denial and prepare an appeal letter — it's information, not legal advice. First, do you have the denial letter or statement in front of you? [29]

**T2** U: Yes, it's right here.
A: Good. On your phone, open the companion page and enter this code: A-C-F, 3-4-7. Then take a photo or upload the file. Tell me when it's in. [31]

*(companion: code → photo → "Reading…" → "Done — go back to your voice assistant")*

**T3** U: Okay, it's uploaded.
A: One moment. *(≤ 2.5 s, else canned)* Here's what I read: Pacific Crest Health Plan denied a laparoscopic gallbladder removal from September 4th, billed at eighteen thousand seven hundred fifty dollars, because prior authorization wasn't obtained. Is that right? [34]

**T4** U: Yes.
A: Thanks. The letter looks like it's from California — is that where you live? [14]

**T5** U: Yes.
A: And how do you get this coverage — through an employer, through Covered California, or bought directly from the insurer? [20]

**T6** U: Through Covered California.
A: Got it. Was this an emergency, or care you had to get right away? [14]

**T7** U: No, it was scheduled.
A: Last one: is this care urgent or still ongoing? [9]

**T8** U: No, it's done.
A: Here's where you stand. Your first deadline is March 10th, 2027 — 140 days from today — to file an internal appeal with the plan, under the federal ACA appeal rules. You also have the right to a free copy of your claim file and the exact criteria they used. And in California, you file a grievance with the plan first; if it isn't resolved in 30 days, you can go to the Department of Managed Health Care, and an independent medical review there is free. Want to hear more, or shall I draft the appeal letter? [97 — rights chunk, ≤ 120]

**T9** U: Draft the letter.
A: I'll write the letter from your facts and those rules, with blanks where I don't know something. Shall I go ahead? [24]

**T10** U: Yes.
A: *(progress)* Done — it's two pages, with four blanks for you to fill, like your name and address. Shall I send it to your email ending in w-dot-gmail-dot-com? [27]

**T11** U: Yes, send it.
A: Sent. The email has the letter, your deadlines with links, and what to attach: the denial letter and a note from Dr. Raman about why the surgery was needed. Send it to the Grievance and Appeals address on your letter. [40]

**T12** A (continues, no question — closing): If you'd like a person to look at it, California's Help Center at the Department of Managed Health Care is free; their number is in the email. I've kept nothing on my side. Take care. [39]

Totals: 12 assistant turns, ~4 minutes with model latency (SC-001).

## 5. No-document path (US2) — 9 turns, Texas prior auth

T1 as above → U: No, I can't find it.
A: No problem — I can still tell you the basics. Which state do you live in? [16]
→ "Texas" → A: Texas. How do you get your coverage — employer, Marketplace, or bought directly? [14]
→ "Employer" → A: What reason did they give? Not medically necessary, no prior authorization, out of network, or something else? [19]
→ "No prior authorization" → A: Roughly when did the letter arrive — a date, or something like 'two weeks ago' is fine. [19]
→ "About two weeks ago" → A: Around September 7th, then. Is the care urgent or still ongoing? [14]
→ "No" → A: Because the date is approximate, treat these as estimates. Your internal appeal deadline is around March 6th — about 165 days — under the federal ACA rules. If the plan is fully insured in Texas, you can also ask for an independent review through the Texas Department of Insurance after the internal appeal. Want more, or a letter with blanks you can fill from the letter when you find it? [78]
→ "The letter" → confirm → send → closing (as T9–T12).

## 6. Error and recovery table

| Situation | Turn |
|---|---|
| Read-back answered "no" | "Okay — which part is off?" (open; five fields would break the ≤ 4-option rule) → user names one → "What should it be?" → templated re-read of that field only → "Better?". If the answer is not understood: "The insurer, the service, the date, or the amount? Or say 'the reason'." |
| Not understood (1st) | "Sorry — was that yes or no?" / "Employer, Marketplace, or bought directly?" |
| Not understood (2nd) | Same options, slower, then: "Or say 'skip' and I'll note it as unknown." |
| Not understood (3rd) | "Let's leave that one. …" (moves on if allowed, else offers human help) |
| Upload not arrived (1st check) | "I don't see it yet. The code is A-C-F, 3-4-7. Say 'ready' when it's in." |
| Upload not arrived (2nd) | "Still nothing on my side. We can keep going without the document — I'll ask a few questions instead. Want that?" |
| Unsupported document | "This looks like a Medicare notice. Medicare appeals work differently, and I'd rather not guess. The email I can send you has the official Medicare appeals line. Want it?" |
| Document says NY, user said TX | "Your letter shows a New York address, but you said Texas. Which should I use for the deadlines?" |
| Model unavailable | "I can't read documents right now. I can still tell you your deadlines from a few questions — want to do that?" |
| Email failed | "The email didn't go through. I've put a one-time download link on the companion page — it works until this conversation ends. Anything else?" |
| Silence after a question | re-prompt once, shortened; then "I'll wait. Say 'Alexa, continue my appeal' when you're ready." |
| Two deadlines within 7 days | "Your first deadline is …; a second one, for the external review, is close behind — both are in the email." |

## 7. Confirmation grammar

Yes: `yes | yeah | yep | correct | that's right | right | go ahead | do it | sure | please`.
No: `no | nope | wrong | not quite | that's not right | don't | stop`.
Anything else on a consequential question → re-ask with both options: "Please say yes to send, or no to hold off."
Consequential confirmations are never inferred from earlier enthusiasm ("draft the letter" at T9 still gets T9's explicit yes/no).

## 8. Spoken formats

- Codes: letters spelled, digits as digits, group of three, 300 ms break between groups; on "repeat", NATO words ("Alpha, Charlie, Foxtrot").
- Money: "eighteen thousand seven hundred fifty dollars" (no cents unless < $100).
- Dates: "December 1st" this year, "March 10th, 2027" otherwise; always followed by "— N days from today".
- Email: local part first letter + "dot" domain read as words ("w… at gmail dot com"); never the full address.
- Sources: short names only ("the federal ACA appeal rules", "the No Surprises Act", "California's Department of Managed Health Care"); full citation and link in the email.

## 9. What the video shows in the first 30 seconds

T1 → T3 (the read-back) with the companion phone in frame, then a jump cut to T8 (deadline as a
date and days). The rest of the flow, the judge's MCP Inspector view, and the email land in the
remaining two minutes.

## 10. Measured against the spec

FR-001/002 (turn shape) — post-check counters; FR-003/004 (read-back, explicit yes) — state
machine refuses otherwise; FR-005 — universal command table; FR-006/008 — opening line and
`overturn_get_help`; FR-007 — templates always append the source name; SC-005 — five golden
transcripts (US1 sample 02, US1 sample 01 with a correction, US2 TX, unsupported Medicare, cancel
mid-way) reviewed by hand.
