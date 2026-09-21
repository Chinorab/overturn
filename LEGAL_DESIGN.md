# Legal design: why Overturn is legal information, not legal advice

Overturn helps people understand and contest a health insurance denial. In the United States,
advising a specific person on what to do about their specific legal problem is generally the
practice of law, reserved to licensed attorneys (see ABA Model Rule 5.5 and each state's
unauthorized-practice statutes). Explaining what a document says, what rules generally apply,
and what options exist is legal *information*, which anyone may provide, and which court
self-help centers, consumer assistance programs, and regulators provide every day.

Overturn is built to stay on the information side of that line. This is not a disclaimer; it
is a set of design constraints that shape what the product can and cannot produce.

## The line we drew

| Legal information (what Overturn does) | Legal advice (what Overturn refuses to do) |
|---|---|
| "This letter says the claim was denied as not medically necessary." | "Your denial was wrong." |
| "Federal rules give at least 180 days to file an internal appeal (29 CFR 2560.503-1(h)(3)(i))." | "You should appeal by next Friday." |
| "For emergency care, the No Surprises Act limits cost sharing to the in-network amount." | "You will win this because of the No Surprises Act." |
| "Here is a draft letter built from your facts, for you to edit and send." | "Send this letter as-is; it is your best option." |
| "These free services can look at your case with you." | "You don't need a lawyer." |

## Three layers of enforcement

### 1. Prompt layer (what the model is allowed to say)

Every model call carries a system instruction that forbids conclusions about the merits,
outcome predictions, and imperative advice. Concretely:

- The **extraction** call only reads the document. It returns facts with a verbatim quote and
  a page number for each, or `null`. It is told never to infer from typical practice.
- The **explanation** call is told to describe, never to instruct; a banned-phrase list
  (`you should`, `you must`, `I recommend`, `guaranteed`, `will win`, `legal advice`…) is part
  of the prompt and re-checked in code. The output must read at grade 8 or below.
- The **drafting** call writes in the patient's voice *to the plan*. It may not address the
  patient, may not claim the denial was unlawful, may not predict outcomes, and may not assert
  anything the patient did or did not do; unknowns become `[ADD: …]` placeholders.

### 2. Product layer (what the code decides, and what it verifies)

- **The model never decides which rules apply.** A deterministic rules engine
  (`lib/rules/engine.ts`) computes applicable protections and deadlines from a versioned
  dataset (`data/rules/*.json`). Every rule carries a legal reference, a primary-source URL, and
  the date it was last verified. A build-time test fails if any rule lacks one.
- **Every deadline shows its formula**: anchor date + rule, with the source. If the document
  states a shorter window than the legal minimum, both are shown and the discrepancy is named.
- **The letter can only cite rules the engine produced.** Citations are emitted as
  `[[cite:rule_id]]` markers; the server strips any marker that is not in the computed set and
  reports it. A second pass scans for advice-style phrasing and regenerates once.
- **"I don't know" is a first-class answer.** When plan funding is unknown, both routes are
  shown with a caveat rather than one being silently chosen.
- **Out-of-scope means stop.** Medicare, Medicaid, and TRICARE documents produce an honest stop
  screen with the official link, not an approximate answer.
- **Human help is one tap away on every screen**, listing the state Consumer Assistance
  Program or regulator, and the federal options.

### 3. Copy layer (how the interface speaks)

- Descriptive, second-person, present tense: "This looks like a prior-authorization denial",
  never "You must appeal."
- The "Information, not advice / Not a lawyer / Nothing stored" panel is above the fold on the
  first screen at phone width, and the header carries "Information, not legal advice"
  throughout.
- Generated text is labeled "Written by AI from your document"; rules are labeled "From the
  rules dataset, not AI".
- The letter step is framed as *the user's* draft: "for you to finish", with a "Before you
  send" checklist and a pointer to free human review.

## What this does not claim

Overturn does not claim that its information is complete for every situation, that a state's
rules are covered outside California, New York, and Texas, or that a deadline computed from a
letter date is the only one that could apply. It says so in the interface, in plain words, at
the point where it matters.

## Privacy is part of the same design

Legal information about a medical denial is only safe to give if the document itself is safe.
Documents are processed in memory during one request and discarded; nothing is stored
server-side; only timing and token counts are logged. The demo uses synthetic documents.

---

## Addendum (October 2026): the same line, spoken

Feature 002 puts Overturn behind a voice assistant (built for Alexa+, delivered as a simulated
Alexa+ experience driving a real MCP server). A conversation is a different medium from a screen:
the person cannot re-read, cannot see a label, and a confident voice sounds more like advice than
the same words in a text box. So the line does not move, but a fourth layer holds it, and the
first three are re-applied to speech.

### 4. Action layer (what the server refuses to do without a yes)

On a screen the user *clicks* "Draft my letter"; by voice, a model decides when to call a tool.
That decision is not trusted. The server's state machine enforces:

- **Read back before relying.** Every fact the engine will use — read from the document or spoken
  by the person — is read back (≤ 40 words, from a template) and must receive a "yes" before the
  case advances. A "no" reopens exactly one field.
- **Explicit yes for consequences.** `draft_letter`, `send_letter` and `discard_case` refuse to
  act unless the call carries `confirmed: true`; when it is missing they return the exact question
  the assistant must ask ("Shall I send it to your email ending in …?"). Enthusiasm earlier in the
  conversation ("draft the letter!") does not count; the question is asked again at the moment of
  action, and the yes/no grammar is closed (Appendix, `voice-design.md` §7).
- **Order is enforced by code.** Rights are computed only from confirmed facts; a letter only from
  computed rights; a send only from a drafted letter. Out-of-order calls fail with `wrong_state`
  whatever the model intended.
- **The destination is not negotiable.** The letter goes only to the email of the account the
  person linked (OAuth, Amazon Cognito). There is no recipient parameter; a spoken or typed address
  is never accepted. Before sending, the address is read back masked.

### Prompt layer, spoken

- The assistant's **first turn** states that it gives information, not legal advice, before asking
  anything — the spoken equivalent of the above-the-fold panel.
- **Deadlines, protections and their sources are never spoken by the model.** Tool results carry
  a `speak` string generated from templates over the rules dataset ("Your first deadline is
  December 1st — 71 days from today — under the federal ACA appeal rules"). The model's own words
  are limited to glue and empathy; a post-check rejects turns containing prescriptive or predictive
  phrases and regenerates or truncates them.
- "Should I appeal?" and "Will I win?" get a one-sentence deflection and an offer of free human
  help; the tool `overturn_get_help` exists so that the answer is always the same and always
  sourced.

### Product layer, spoken

- **Same engine, same dataset.** The MCP server calls the feature-001 functions unchanged; the
  golden table that proves the engine's determinism is the same test. Any client — Alexa+, the
  simulator, MCP Inspector — gets identical rights for identical facts.
- **Sources are named aloud and linked in writing.** Voice cannot carry a URL, so every spoken
  protection names its source ("the No Surprises Act", "California's Department of Managed Health
  Care") and the emailed summary carries the link, the legal reference and the last-verified date.
- **Approximate means approximate.** In the no-document path, deadlines computed from "about two
  weeks ago" are labelled as estimates in speech and in the summary, anchored to the date the
  person gave.
- **Out-of-scope still means stop.** A Medicare answer or document ends the case with the official
  channel; no letter is offered.

### Copy layer, spoken

- One question per turn, ≤ 60 words, Grade-8 vocabulary, no exclamation marks, no "Great
  question". Descriptive, second person: "This looks like a prior-authorization denial."
- The written artefacts keep the labels: the email footer carries "Information, not legal advice"
  and "Written with AI from your facts; rules from a verified dataset"; the letter is "your draft,
  for you to finish", with the same "before you send" checklist.
- The simulator is labelled **"Alexa+ simulation (unofficial)"** on screen; it never claims to be
  a device or an Amazon product.

### What voice does not claim

Voice adds no legal capability. It does not decide anything the screen did not; it covers the
same three states and the same plan types; it says so when it reaches an edge. It also does not
pretend that a spoken confirmation is a signature: the person still sends the letter themselves,
from their own inbox, after reading it.

### Privacy, spoken

A conversation creates two new places where health information could leak, and both are closed:

- **Nothing is stored between turns except in memory.** A case exists in the server's memory for
  one conversation and is discarded on send, on cancel, or after 30 minutes of silence. There is
  no database, no disk, no transcript kept server-side; the simulator's transcript lives in the
  browser session and is cleared when the case ends.
- **Email is the one written channel, and it is one-way to the person.** The letter and summary
  are sent by Amazon SES to the linked account's address only, after an explicit confirmation that
  names it. The uploaded document is never emailed. SES keeps delivery metadata, not attachments.
  If sending fails, a one-time download link on the companion page replaces it and dies with the
  case.
- **Logs are scrubbed.** No document text, extracted facts, letter text or email addresses reach
  the logs on the server or on the simulator; only timings, token counts, tool names and error
  codes.
- **The assistant never asks for an address, a member ID or a Social Security number by voice.**
  Blanks in the letter (`[ADD: …]`) stay blanks for the person to fill on paper.
