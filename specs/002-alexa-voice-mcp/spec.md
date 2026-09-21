# Feature Specification: Alexa+ Voice Appeal Assistant (MCP)

**Feature Branch**: `002-alexa-voice-mcp`

**Created**: 2026-09-21

**Status**: Draft — awaiting scope validation

**Input**: User description: "Expose Overturn's appeal engine as a self-hosted MCP server (spec 2025-11-25, Streamable HTTP, OAuth 2.1 PKCE per Alexa+ MCP Toolkit requirements) and build a simulated Alexa+ voice experience in a web app that drives it: a user says "Alexa, my insurance denied my claim, help me appeal" and is guided end to end by voice — one short question at a time, confirmation before any action, denial document captured via companion upload, deadlines and rights read aloud, final appeal letter delivered by email (Amazon SES, fallback download link). LLM provider abstracted (Anthropic default, Nebius Nemotron alternative). US legal context only, English only, no secrets in code, nothing stored after the session. Built for the Amazon Build, Ship, Shape hackathon (Alexa+ track, AWS Builder and Open Source mini-challenges)."

## Problem Statement

Overturn v1 (feature 001, LexHack) proved that a stressed non-expert can go from a denial
letter to a sourced appeal letter in five minutes — on a phone, reading a screen. But the
people most likely to give up on an appeal are often the people least comfortable with a
form-driven web flow: older adults, people with low vision or limited literacy, people who
are sick and exhausted, people who talk to an assistant in their kitchen more readily than
they open a browser. For them the natural first move is to *say* what happened.

This feature makes Overturn's engine reachable through a conversational assistant: the user
speaks, the assistant asks one short question at a time, reads back the facts, reads the
deadlines and protections aloud, and — only on explicit confirmation — sends a finished appeal
letter to the user's inbox. The engine's guarantees are unchanged: **the model reads, the code
decides, the human sends.** The assistant is a new front door, not a new brain.

## Context: hackathon constraints that shape scope

| Constraint | Consequence for this feature |
|---|---|
| Alexa+ MCP Toolkit is *"available to select partners"* (verified 2026-09-21); no public simulator, CLI or add-on registration for individuals | The assistant is delivered as the hackathon's sanctioned alternative: a **simulated Alexa+ experience in a web app**, driven by a real MCP client against the real MCP server. The server is built to the published Alexa+ integration requirements so it is connectable the day access opens. |
| Track requirement: self-hosted MCP server, spec 2025-11-25 or later, Streamable HTTP; repo must load the MCP config in code | Non-negotiable; verified by an automated conformance test. |
| Submission window: 2026-09-28 → 2026-10-23 12:00 PDT; prior work must be clearly separated | README carries a "Built during the hackathon" section; every new artifact lives in new directories or is listed there. |
| Mini-challenges: AWS Builder (documented AWS integration), Open Source (new licensed project) | Letter delivery uses an AWS mail service; the MCP server is deployable to an AWS runtime. The state rules dataset is published as a separate MIT-licensed repository. |
| Product feedback per tool and friction log (bonus up to 10 %) | `FEEDBACK.md` and `FRICTION_LOG.md` are kept in the repo and updated as work happens. |

## Scope Boundaries *(read first)*

### In scope

| Dimension | Supported |
|---|---|
| Entry | The user asks the assistant for help with a denied claim, a denied prior authorization, or a surprise bill, in free words |
| Document capture | (a) Upload on a companion screen (phone/web) using a short spoken case code; (b) one of the bundled sample documents (for demo and for people who want to try first); (c) **no document**: the user answers a handful of questions by voice and gets the federal + state baseline with a letter template with visible blanks |
| Conversation | One question per turn; every answer read back before it is used; explicit yes/no confirmation before the two consequential steps (drafting the letter, sending it); "repeat", "go back", "I don't know", "stop" understood at every turn |
| Outputs by voice | Who denied what, when, why, in one breath; the first deadline as a date and days remaining; the two or three most relevant protections in plain English with the name of the source; where free human help is |
| Outputs in writing | The appeal letter (PDF) plus a one-page summary of deadlines, protections with links, attachment checklist and where-to-send block, delivered by email to the address associated with the user's linked account; if email cannot be sent, a one-time download link is read/displayed on the companion screen |
| Jurisdictions, coverage types, denial categories | Identical to feature 001 (federal baseline; CA, NY, TX overlays; commercial/Marketplace/ERISA plans) |
| Assistant surfaces | The simulated Alexa+ web app (voice in, voice out, transcript, companion card); any standards-compliant MCP client (for judges and for future real Alexa+ connection) |
| Open dataset | The state appeal rules dataset published separately under MIT with its schema, validation script, per-rule sources and last-verified dates, and a contribution guide for adding a state |

### Explicitly out of scope (and why)

| Cut | Why |
|---|---|
| Publishing to real Alexa+ devices | Access is partner-only during the hackathon window. The server is built to the published requirements; a documented "when access opens" checklist replaces the deployment. |
| Reading a full letter aloud | Voice is the wrong channel for a two-page legal letter; the assistant reads the *facts* and *rights*, the letter goes to a written channel. |
| Dictating the recipient email by voice | Error-prone and a privacy leak risk if misheard. The address comes from the linked account (typed once on the companion screen in the simulation), and is read back masked before sending. |
| Reading the denial letter aloud to the assistant | Long, error-prone transcription of PHI; the companion upload or the no-document path covers the need. |
| Case memory across sessions, reminders, follow-up on the appeal | Would require storing PHI; unchanged from feature 001. |
| Medicare/Medicaid/TRICARE/VA, other 47 states, itemized bill audit, Spanish | Unchanged from feature 001; the assistant says so honestly and points to the right resource. |
| Voice biometrics, multi-user households, child profiles | Simulation covers one authenticated user per session. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Appeal by voice with the letter in hand (Priority: P1)

Walter, 71, has a denial letter on the kitchen table and does not want to squint at a phone
form. He says: "Alexa, my insurance denied my claim, help me appeal." The assistant explains in
two sentences what it can and cannot do, then asks whether he has the letter. He says yes. The
assistant gives him a six-character code and tells him to open the companion page on his phone
and take a photo. Once the document is in, the assistant reads back the key facts in one
breath ("Blue Ridge Health denied a $3,400 MRI on May 2nd, saying it was not medically
necessary. Is that right?"). It asks the two or three questions it still needs, one at a time.
It then tells him his first deadline as a date and a number of days, and the protections that
apply, naming the source. It asks whether he wants a draft appeal letter. He says yes. It asks
whether to send it to the email ending in "…@gmail.com". He says yes. He hears that it was
sent, what to attach, where to send it, and who to call for free help.

**Why this priority**: This is the headline experience of the track and the first 30 seconds
of the demo video. Everything else is a variation of it.

**Independent Test**: With a bundled sample document staged on the companion page, the full
flow can be completed by voice in the simulated Alexa+ app, ending with an email containing the
letter PDF and the summary; the transcript shows no more than one question per assistant turn.

**Acceptance Scenarios**:

1. **Given** the user has said a phrase containing "denied", "denial", "appeal", "insurance", "claim" or "surprise bill", **When** the assistant answers, **Then** its first turn states in ≤ 2 sentences that it gives information, not legal advice, and asks one question: whether the user has the document.
2. **Given** the user has the document, **When** the assistant offers the companion upload, **Then** it speaks a code of 6 alphanumeric characters (no ambiguous pairs such as 0/O, 1/I) and repeats it on request; the companion page accepts the code and a PDF/JPG/PNG up to 10 MB.
3. **Given** the document is received, **When** the assistant reads back the facts, **Then** the read-back names the payer, the service, the date, the amount if present and the denial reason in ≤ 40 words and ends with a yes/no question.
4. **Given** the user says "no, that's wrong" to a read-back, **When** the assistant continues, **Then** it asks which item is wrong and accepts a spoken correction for that item only.
5. **Given** facts are confirmed, **When** rights are computed, **Then** the assistant speaks the earliest deadline as an absolute date and a days-remaining count, then at most three protections, each in ≤ 2 sentences with the name of its source, and offers "more" for the rest.
6. **Given** rights have been spoken, **When** the user says yes to a letter, **Then** the assistant confirms the masked destination address before sending, sends only after an explicit yes, and reports success or the fallback download link.
7. **Given** any turn, **When** the user says "stop", "cancel" or "never mind", **Then** the assistant confirms the case is discarded and nothing was kept.

---

### User Story 2 — Appeal by voice without the document (Priority: P2)

Dana lost the letter but remembers the gist: employer plan, Texas, denied for "no prior
authorization", got the letter around two weeks ago. She says she does not have the document.
The assistant asks, one at a time: state, how she gets her coverage, the reason the insurer
gave (from a short spoken list), roughly when the letter arrived, and whether the care is
urgent or ongoing. It computes the federal and Texas baseline, reads the deadline as a range
("if the letter arrived around September 7th, your internal appeal deadline is around March
6th — about 165 days"), the protections, and offers a letter with visible blanks for
everything she will need to fill in from the letter when she finds it.

**Why this priority**: Voice-first users often do not have the paper at hand; this path keeps
the assistant useful instead of ending with "go find the letter". It also exercises the
deterministic engine without any document reading, which makes it the most robust demo path.

**Independent Test**: Without any upload, five spoken answers lead to a spoken deadline and
protections and an emailed letter with `[ADD: …]` blanks; the rules applied match the golden
table for (TX, employer, prior-auth, non-urgent).

**Acceptance Scenarios**:

1. **Given** the user says they do not have the document, **When** the assistant continues, **Then** it asks no more than five questions, each with ≤ 4 spoken options, and accepts "I don't know" for all but state.
2. **Given** an approximate letter date, **When** the deadline is spoken, **Then** it is labelled as approximate and anchored to the date the user gave.
3. **Given** an unsupported state, **When** rights are computed, **Then** the assistant says only the federal baseline applies, names the state's regulator, and still offers the letter.
4. **Given** a Medicare/Medicaid answer, **When** coverage is identified, **Then** the assistant stops, says why, and names the official channel.

---

### User Story 3 — A judge connects any MCP client (Priority: P1)

A judge points a standard MCP client at the server URL. Discovery lists a small set of
clearly-named capabilities with descriptions written for an orchestrating assistant. The judge
can walk the full case by calling them in order, gets structured results, and sees that the
server refuses unauthenticated calls and that every rights statement carries a source.

**Why this priority**: This is the track's hard technical requirement and the thing the
"repo must load the MCP config" rule checks.

**Independent Test**: An automated conformance test starts the server, performs the protocol
handshake over the required transport, lists capabilities, runs a complete sample case, and
asserts every deadline/protection result carries a source URL and a last-verified date.

**Acceptance Scenarios**:

1. **Given** a request without credentials, **When** it reaches the server, **Then** it is refused with the standard unauthorized response and a pointer to how to authorize.
2. **Given** an authorized client, **When** it lists capabilities, **Then** each has a name, a one-paragraph description of when to use it, a typed input and a typed output, and no capability requires knowledge of internal identifiers other than the case code.
3. **Given** a case in progress, **When** the client calls a consequential capability (draft, send) without a prior confirmation flag, **Then** the server refuses and returns the exact confirmation question the assistant should ask.
4. **Given** 30 minutes of inactivity, **When** the client calls with the case code, **Then** the case is gone and the response says so.

---

### User Story 4 — Reuse the rules dataset (Priority: P2)

A civic-tech developer in another state finds the open dataset, reads the schema and the
"add a state" guide, and can validate a new rules file locally with one command. She cites
the dataset in her own tool.

**Why this priority**: Open Source mini-challenge, and the strongest "impact beyond the demo"
argument.

**Independent Test**: Cloning the dataset repository and running its validation command passes
on the shipped data and fails on a rule missing a `source_url` or with a `last_verified` older
than the allowed window.

**Acceptance Scenarios**:

1. **Given** the dataset repository, **When** a reader opens it, **Then** it has an MIT license, a README stating scope, schema, provenance and limitations, a machine-readable schema, one file per jurisdiction, and a changelog.
2. **Given** the Overturn application, **When** it loads rules, **Then** it consumes the same files (vendored or as a dependency) so the two cannot drift silently.

---

### User Story 5 — Deployed and documented (Priority: P2)

The MCP server runs on a public URL on an AWS runtime, with the letter emailed through the AWS
mail service, and the README explains in one page how to run it locally, how to deploy it, and
what would change when real Alexa+ access is granted.

**Why this priority**: AWS Builder mini-challenge and judge accessibility; it also forces the
"no secrets in code" discipline to be real.

**Independent Test**: A fresh machine following the README reaches a working local server and
simulator in under 15 minutes; the public URL passes the same conformance test.

**Acceptance Scenarios**:

1. **Given** the README, **When** a reader follows it, **Then** every configuration value is an environment variable with an example file and none is a real secret.
2. **Given** the mail service is unavailable, **When** the user confirms sending, **Then** the assistant offers a one-time download link and says the email failed.

---

### Edge Cases

- **Misheard yes/no**: confirmations accept a closed set ("yes", "yeah", "correct", "that's right", "no", "wrong", "not quite"); anything else triggers a re-ask with the two options spoken explicitly.
- **Long silence or no reply**: the assistant re-prompts once, then says how to resume within the session window and ends the turn; the case survives until the inactivity limit.
- **Upload never arrives**: after two check-ins the assistant offers the no-document path or a later retry with the same code.
- **Two deadlines close together**: the assistant speaks the earliest, says a second one exists, and puts both in the written summary.
- **Document contradicts a spoken answer** (e.g. user said Texas, letter shows New York): the assistant states the discrepancy and asks which to use.
- **Unsupported document** (Medicare, non-English, unrelated): the assistant says what it found and stops with the right resource; no letter is offered.
- **Model service down**: the no-document path still works end to end (it needs no reading); the assistant says the upload path is temporarily unavailable.
- **Two cases with the same code**: codes are unique for the lifetime of a case and never reused within 24 hours.
- **User asks "will I win?" or "should I appeal?"**: the assistant declines to predict or advise, in one sentence, and offers free human help.
- **Companion screen opened without a code**: it explains the code comes from the assistant and offers to try with a sample.

## Requirements *(mandatory)*

### Functional Requirements

**Conversation**

- **FR-001**: The assistant MUST ask at most one question per turn and MUST NOT present more than four options in a single spoken question.
- **FR-002**: Every spoken assistant turn MUST be ≤ 60 words, except the rights read-out which MUST be ≤ 120 words and chunked so the user can say "more".
- **FR-003**: The assistant MUST read back every fact it will rely on (document facts and spoken answers) and obtain a yes before using it.
- **FR-004**: The assistant MUST obtain an explicit yes immediately before drafting the letter and immediately before sending it; the sending confirmation MUST include the masked destination address.
- **FR-005**: "Repeat", "go back", "I don't know", "help" and "stop/cancel" MUST be understood at every turn with the documented behaviour.
- **FR-006**: The assistant MUST state in its first turn that it provides information, not legal advice, and MUST refuse outcome predictions and prescriptive advice at any turn (Constitution I).
- **FR-007**: Every spoken protection or deadline MUST name its source in the same turn, and the written summary MUST carry the link.
- **FR-008**: The assistant MUST offer free human help (state Consumer Assistance Program or regulator) at least once per case and whenever the user expresses distress or asks for advice.

**Document capture and case data**

- **FR-010**: The assistant MUST offer three ways to establish the facts: companion upload with a spoken case code, a bundled sample, or spoken answers without a document.
- **FR-011**: Case codes MUST be 6 characters from an alphabet without visually or phonetically ambiguous pairs, unique for 24 hours.
- **FR-012**: The companion screen MUST accept PDF/JPG/PNG up to 10 MB and MUST show the assistant's read-back status so the user knows when to return to voice.
- **FR-013**: Extraction, explanation, rules computation and letter drafting MUST reuse the feature-001 engine unchanged in behaviour (same schemas, same rules dataset, same guards); the assistant MUST NOT compute or reword any deadline or rule itself.
- **FR-014**: The no-document path MUST collect at most: state, coverage source, denial reason category, approximate document date, urgency; and MUST label all derived deadlines as approximate.

**Delivery**

- **FR-020**: The letter MUST be delivered as a PDF attachment with a one-page written summary (deadlines with anchors, protections with links, attachment checklist, where to send, human help), to the email associated with the authorized account.
- **FR-021**: If delivery fails, the assistant MUST offer a one-time download link valid for the remaining session and MUST say the email failed.
- **FR-022**: The email MUST contain the same "information, not advice" statement as the web app and MUST NOT contain the uploaded document.

**Assistant integration surface**

- **FR-030**: The engine MUST be exposed through a self-hosted server implementing the Model Context Protocol at specification version 2025-11-25 or later over the Streamable HTTP transport, with discovery, typed inputs and outputs, and descriptions written for an orchestrating assistant.
- **FR-031**: The server MUST refuse unauthenticated requests with the standard unauthorized response and MUST support the authorization flow the Alexa+ integration documentation requires (authorization code with PKCE), so that a real Alexa+ connection needs configuration, not code.
- **FR-032**: Consequential capabilities (draft, send, discard) MUST require a confirmation flag and, when it is missing, MUST return the confirmation question to ask rather than acting.
- **FR-033**: The server MUST answer any single capability call in under 5 seconds except document reading and letter drafting, which MUST report progress and complete in under 60 seconds.
- **FR-034**: The simulated Alexa+ web app MUST drive the server exclusively through the same protocol a real assistant would use (no private back-channel), MUST support spoken input and spoken output, MUST show a transcript, and MUST visibly label itself as a simulation.
- **FR-035**: The language-model provider used by the engine MUST be selectable by configuration between at least two providers, with identical behaviour on the bundled samples.

**Privacy and security**

- **FR-040**: Case data (document, facts, answers, letter) MUST live only in server memory for the duration of the case and MUST be discarded on send, on cancel, or after 30 minutes of inactivity, whichever comes first; nothing is written to disk or a database.
- **FR-041**: No credential, key or account identifier may appear in source; all configuration is by environment variable with a committed example file; the existing repository secret check MUST cover the new code.
- **FR-042**: Emails MUST be sent only to the address of the authorized account; the assistant MUST never accept a spoken email address.
- **FR-043**: Logs MUST NOT contain document text, extracted facts, letter text or email addresses.

**Open dataset and documentation**

- **FR-050**: The state rules dataset MUST be published as a separate public repository under the MIT license with: schema, one file per jurisdiction, per-rule `source_url` and `last_verified`, a validation command, a changelog, and an "add a state" guide; the application MUST consume the same files.
- **FR-051**: The README MUST contain a "Built during the hackathon" section listing what existed before 2026-09-28 (feature 001) and what was built during the window, at directory granularity.
- **FR-052**: `FEEDBACK.md` MUST cover every tool, SDK, API and service used during the window (usage, what worked, what did not, onboarding quality, would reuse); `FRICTION_LOG.md` MUST record each friction at the time it occurs (task, steps, expected vs actual, severity, workaround, suggestion).

### Key Entities

- **Case**: one conversation's working state — case code, status (started, awaiting document, facts pending, facts confirmed, rights computed, letter drafted, sent, discarded), facts, answers, computed rights, letter, expiry time. Exists only in memory.
- **Fact read-back**: the ≤ 40-word spoken summary of the facts the engine will rely on, plus the yes/no it received.
- **Spoken rights summary**: the earliest deadline (date, days remaining, anchor, approximate flag) and the ordered protections, each with a spoken source name and a written link.
- **Delivery**: destination (masked for speech), channel (email or download link), outcome, timestamp; not retained after the case.
- **Capability**: one named operation the assistant can invoke on the server, with its description, typed input/output, and whether it is consequential (requires confirmation).
- **Rules dataset release**: a versioned snapshot of the jurisdiction rule files with schema and validation, published separately and consumed by the application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user completes the P1 flow (sample document → emailed letter) by voice in under 4 minutes and at most 12 assistant turns.
- **SC-002**: A first-time user completes the no-document flow in under 3 minutes and at most 9 assistant turns.
- **SC-003**: 100 % of spoken deadline/protection statements in the transcript name a source; 100 % of them in the email carry a link.
- **SC-004**: On the golden (state × coverage × category × urgency) table, the rights spoken by the assistant match the feature-001 engine output in 100 % of cases (same engine; any difference is a bug).
- **SC-005**: A reviewer reading five complete transcripts finds zero turns with more than one question, zero prescriptive or predictive sentences, and zero consequential actions without a preceding explicit yes.
- **SC-006**: An independent, standards-compliant assistant client can discover and run a full case against the public server without reading the source code, using only capability descriptions.
- **SC-007**: The automated protocol conformance test passes locally and against the public deployment on the submission day.
- **SC-008**: A fresh developer reaches a working local server and simulator from the README in under 15 minutes.
- **SC-009**: The open dataset repository's validation passes on its shipped data, and the application build fails if its vendored copy diverges from the released version.
- **SC-010**: Switching the language-model provider by configuration yields the same extracted required fields on the bundled samples (≥ 90 % match to golden, as in feature 001) with no code change.
- **SC-011**: `FRICTION_LOG.md` has at least one dated entry per week of the window and `FEEDBACK.md` covers every external tool listed in the README.

## Assumptions

- The Alexa+ MCP Toolkit remains partner-only through 2026-10-23; the simulated web app is the demo surface. If access opens earlier, the server is connected as-is and the simulation stays as a fallback for judges.
- "Alexa" in the simulation is a wake word shown in the transcript, not a trademark claim; the app is labelled as an unofficial simulation.
- The user's email address is known from account authorization (in the simulation: entered once on the companion/sign-in screen), not spoken.
- Speech recognition and synthesis in the simulation are the browser's; recognition errors are handled by read-back and confirmation rather than by better recognition.
- The rules dataset is the feature-001 dataset, extracted into its own repository with its existing validation test; no new states are added during the window unless time allows.
- The feature-001 web app stays live and unchanged; the engine is shared, not duplicated.
- The default language-model provider stays the one feature 001 used; the second provider is exercised on the bundled samples, not necessarily on live uploads, for the Amazon submission.
- The AWS deployment is a single region in the United States; the mail sender domain is verified once, manually, outside the repository.
- Voice latency in the simulation is dominated by model calls; the assistant covers waits longer than ~3 seconds with a short spoken acknowledgement rather than silence.

## Open Questions for Scope Validation

1. **No-document path (US2)** — keep as P2 in the hackathon scope, or defer to protect P1? Recommendation: keep; it is the most robust demo path and needs no model call.
2. **Companion upload vs. sample-only for the video** — the demo can stage a sample on the companion page; do we also show a live phone photo? Recommendation: sample for the first 30 seconds, live photo as a second shot if time allows.
3. **Real-device stretch goal** — a community bridge (classic Alexa skill + agent on an AWS runtime) can drive an MCP server from a physical Echo. Out of the spec; to be revisited at the plan as an optional final-week item only if everything else is green.
