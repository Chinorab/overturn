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
