# Feature Specification: Denial & Bill Appeal Assistant

**Feature Branch**: `001-denial-appeal-assistant`

**Created**: 2026-09-18

**Status**: Delivered (v1, 2026-09-19) — scope validated 2026-09-18; see "Delivery notes" at the end

**Input**: User description: "A tool that helps Americans contest a health insurance denial or an
erroneous medical bill. The user uploads a denial letter or Explanation of Benefits; the tool
extracts key facts, explains in plain language what happened, identifies likely errors and the
protections that apply (No Surprises Act, internal and external appeal rights, state-specific
deadlines), then generates a ready-to-send appeal letter. Informs, does not advise."

## Problem Statement

Fewer than 1 in 200 denied health insurance claims are appealed, yet when consumers do appeal,
a large share of denials are reversed. The gap is not motivation — it is that the documents are
unreadable, the rights are unknown, and the deadlines are invisible. This feature closes that
gap for one narrow, well-defined slice: a person holding a denial letter or EOB from a
commercial or Marketplace health plan, in one of three supported states, with no lawyer and
no time.

## Scope Boundaries *(read first)*

### In scope (v1, LexHack submission)

| Dimension | Supported |
|---|---|
| Document types | (a) Adverse benefit determination / denial letter; (b) Explanation of Benefits (EOB) showing a denied or partially paid claim |
| Coverage types | Employer-sponsored (fully insured **and** self-funded/ERISA), ACA Marketplace, individual commercial plans |
| Jurisdictions | Federal baseline (applies everywhere) + state overlays for **California, New York, Texas** |
| Denial categories | Medical necessity; prior authorization missing/not obtained; out-of-network; not a covered benefit / exclusion; coding or administrative error; experimental/investigational; timely filing; duplicate claim |
| Protections surfaced | Internal appeal right & deadline; external review right & deadline; expedited (urgent) review; No Surprises Act balance-billing protection (emergency, out-of-network at in-network facility, air ambulance); right to request the claim file and clinical criteria free of charge |
| Outputs | Plain-language summary; deadline clock; applicable-protections panel with sources; likely-issue flags; editable appeal letter draft (download as PDF or copy); attachment checklist; where-to-send guidance; free human-help pointers |
| Input | PDF or image (JPG/PNG) up to 10 MB / 20 pages, or one of the bundled sample documents |

### Explicitly out of scope (and why)

| Cut | Why |
|---|---|
| Medicare, Medicaid, TRICARE, VA | Entirely different multi-level appeal systems (redetermination → reconsideration → ALJ…). A wrong deadline here harms people. Better to say "not supported" than to be approximately right. |
| The other 47 states | Each state's external-review statute differs (deadlines, fees, regulator, IMR vs IRO). Three states covering ~27% of the US population, with three distinct regulator models (CA dual DMHC/CDI, NY DFS, TX TDI), demonstrates the architecture; unsupported states get the federal baseline plus a link to their own regulator, never a guess. |
| Itemized bill audit (CPT upcoding, unbundling, duplicate line items, price benchmarking) | Requires billing-code databases and regional price data; a distinct product. v1 keeps only the balance-billing check that can be inferred from an EOB. |
| Good Faith Estimate dispute (uninsured / self-pay) | Different statute path (patient-provider dispute resolution); no insurer involved. |
| Dental, vision, pharmacy-only plans | Different benefit structures and often different appeal routes. |
| Sending the letter (email / fax / e-sign) | Adds accounts, PHI storage, and delivery liability. Download is enough for the demo and keeps the privacy model simple. |
| User accounts, case history, reminders | Storing PHI is the wrong trade for a 9-day build; also makes the privacy story weaker. |
| Spanish and other languages | High impact, deferred; the architecture (rules in data, prose from the model) makes it a cheap v2. |
| Dedicated OCR pipeline | The model reads PDFs and images directly. Poor scans fall back to an editable extracted-fields form. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Understand my denial (Priority: P1)

Maria receives a two-page letter from her insurer saying a claim was "not medically necessary"
and owes $3,400. She opens Overturn on her phone, uploads a photo of the letter, and within a
minute sees: who denied what, on which date, for which reason, in plain English — and how many
days she has left to respond.

**Why this priority**: This is the core value and the whole demo. If nothing else ships, a
person who understands their letter and their deadline is already better off.

**Independent Test**: Upload any bundled sample denial letter → a summary card with extracted
facts, a one-paragraph plain-language explanation, and a deadline clock render. No further
interaction required.

**Acceptance Scenarios**:

1. **Given** a legible denial letter PDF, **When** the user uploads it, **Then** within 60 s the
   system shows the insurer name, member/claim identifiers, date of letter, service description,
   date(s) of service, denial reason (categorized + verbatim quote), amount at stake, and the
   appeal instructions the letter itself states.
2. **Given** the extraction has run, **When** the summary renders, **Then** a plain-language
   explanation (≤ 120 words, Grade-8 reading level) describes what the denial means, and every
   jargon term used is defined inline.
3. **Given** the letter date is known, **When** the summary renders, **Then** the deadline clock
   shows the internal-appeal deadline as a date and a "days left" count, labeled as computed from
   the letter date and the applicable rule, with a link to the rule's source.
4. **Given** an EOB (not a letter), **When** uploaded, **Then** the same summary is produced from
   the EOB's remark/denial codes and "amount you may owe" line.
5. **Given** an illegible or unsupported document (e.g. a pharmacy receipt), **When** uploaded,
   **Then** the system says clearly what it could and could not read, offers an editable fields
   form pre-filled with whatever it found, and never shows an empty or fabricated summary.
6. **Given** a document that mentions Medicare or Medicaid, **When** uploaded, **Then** the system
   stops with an honest "not supported in this version" message and links to the correct
   official appeal resource, instead of applying commercial-plan rules.

---

### User Story 2 — Know my rights and deadlines (Priority: P1)

After the summary, Maria answers three short questions (state, where the plan comes from,
whether the care was an emergency) and sees which protections apply to her situation, in
order of relevance, each with a "why this applies" line and a primary source.

**Why this priority**: The deadline and the external-review right are what make the appeal
winnable; state overlays and the No Surprises Act are the differentiators vs. a generic
"how to appeal" article.

**Independent Test**: Choose a sample, answer the questions, and verify that the rights panel
shows the correct set of protections and deadlines for that (state, plan source, denial type)
combination against a golden table.

**Acceptance Scenarios**:

1. **Given** the state was detected from the document, **When** the questions screen renders,
   **Then** the state is pre-selected and the user can change it.
2. **Given** state = NY, plan = employer, self-funded = "I don't know", **When** rights are
   computed, **Then** the panel shows the federal internal appeal (180 days) and external review
   (4 months), notes that the NY DFS external appeal applies if the plan is fully insured, and
   explains in one sentence how to find out (ask HR / check the SPD).
3. **Given** the denial category is "out-of-network" and the user marks the care as an emergency,
   **When** rights are computed, **Then** the No Surprises Act protection appears first, with the
   in-network cost-sharing rule and balance-billing prohibition, sourced.
4. **Given** the denial category is "medical necessity", **When** rights are computed, **Then**
   the panel includes the right to request the clinical criteria and the full claim file free of
   charge, and the option to request a peer-to-peer review.
5. **Given** the letter indicates ongoing or urgent care, **When** rights are computed, **Then**
   the expedited (72-hour) review path is shown above the standard path.
6. **Given** a state outside CA/NY/TX, **When** rights are computed, **Then** only federal rules
   appear, with a clear "state-specific rules not yet covered" note and a link to that state's
   insurance regulator.
7. **Given** any deadline shown, **When** the user inspects it, **Then** the display shows the
   formula (anchor date + rule) and the source URL; deadlines are never shown without both.

---

### User Story 3 — Get a letter I can send (Priority: P2)

Maria taps "Draft my appeal". She gets a formal appeal letter addressed to the insurer's
appeals unit, referencing her claim identifiers, stating the denial reason, requesting the
claim file and the criteria used, and making the strongest factual argument available for her
denial category — in her own voice, with placeholders where only she knows the facts. She
edits it in place, downloads it, and sees a checklist of what to attach and where to send it.

**Why this priority**: The letter is the concrete artifact that converts understanding into
action. It depends on Stories 1 and 2 so it ships after them, but it is the demo's finale.

**Independent Test**: From any sample and any answered question set, generate a letter and
verify it contains all identifiers, the correct legal references for the computed rights, no
fabricated facts, and clearly marked placeholders for unknown facts.

**Acceptance Scenarios**:

1. **Given** a completed rights panel, **When** the user requests a letter, **Then** a draft of
   300–600 words renders within 30 s, using only facts from the extraction and the user's
   answers; anything unknown is a visible `[ADD: …]` placeholder, never an invented value.
2. **Given** the letter is rendered, **When** the user edits any paragraph, **Then** the edit
   persists in the downloadable version.
3. **Given** the letter cites a right, **When** inspected, **Then** the citation matches the
   rights panel exactly (no rule appears in the letter that is not in the panel).
4. **Given** the user downloads, **When** the file is produced, **Then** it is a printable
   letter (PDF) plus the same text copyable as plain text; a separate checklist lists the
   documents to attach (denial letter, EOB, medical records, doctor's letter of support) and
   the destination stated in the denial letter or, failing that, the insurer's generic appeals
   address with an instruction to verify it.
5. **Given** the user reaches the download step, **When** the screen renders, **Then** it shows
   a "Before you send" panel: review the draft, ask your doctor for a supporting letter, keep
   copies, send by a trackable method — and the free human-help options for the chosen state
   (Consumer Assistance Program / regulator hotline).

---

### User Story 4 — Trust the tool (Priority: P2)

Before uploading, a first-time visitor understands in under 20 seconds what Overturn is,
what it is not (not a lawyer, not advice), what happens to their document (processed and
discarded, nothing stored), and can try a sample without uploading anything.

**Why this priority**: The jury will judge the unauthorized-practice-of-law posture and the
privacy posture. Both must be visible design, not a footer.

**Independent Test**: Load the landing page cold; verify the three statements (what it is /
is not / what happens to your document) are visible above the fold on a 375-px-wide screen,
and that "Try a sample" reaches the summary screen without any upload.

**Acceptance Scenarios**:

1. **Given** a first visit, **When** the landing page loads, **Then** the "information, not
   advice" framing and the privacy statement are visible without scrolling on mobile.
2. **Given** any screen that shows a generated statement about a right or a deadline, **When**
   rendered, **Then** the statement is labeled as AI-assisted and linked to its source.
3. **Given** any screen, **When** rendered, **Then** a persistent, unobtrusive "Get free human
   help" entry point is present.

---

### Edge Cases

- Letter date missing or unreadable → deadline clock asks for the date instead of guessing;
  shows rules without dates until provided.
- Letter states a deadline *shorter* than the legal minimum → show both, flag the discrepancy,
  and advise verifying with the regulator (a plan cannot lawfully shorten the 180-day window).
- Letter states a deadline *longer* than the legal minimum → use the letter's (more generous)
  deadline and say so.
- Multiple claims in one EOB → user picks the line to contest; only one contest per session.
- Document in a language other than English → not supported message.
- Upload > 10 MB / > 20 pages → rejected before processing with a clear size message.
- Model extraction returns low confidence on a required field → field is highlighted for
  user confirmation before rights are computed; rights are never computed on unconfirmed
  low-confidence dates.
- Model service unavailable → the sample documents still work from cached extractions so the
  demo never dies live.
- Self-funded status unknown → show both routes, never pick one silently.
- Deadline already passed → say so plainly, then show what may still be possible (late-appeal
  good-cause request, regulator complaint), sourced.

## Requirements *(mandatory)*

### Functional Requirements

**Intake**
- **FR-001**: Users MUST be able to submit a denial letter or EOB as PDF, JPG, or PNG up to 10 MB and 20 pages, from a phone or desktop.
- **FR-002**: Users MUST be able to start from one of at least four bundled anonymized sample documents (one per major denial category, at least one EOB, at least one per supported state) without uploading anything.
- **FR-003**: System MUST reject unsupported documents (Medicare/Medicaid/non-English/unrelated) with a specific, honest message and a link to the correct resource.

**Extraction & explanation**
- **FR-010**: System MUST extract, with a per-field confidence: insurer name, member ID, claim number, date of letter/EOB, provider, service description, date(s) of service, denial category (from the fixed taxonomy), verbatim denial reason, amounts (billed, allowed, plan paid, patient responsibility), stated appeal instructions and deadline, network status signals, emergency/urgency signals, and the state suggested by the addresses.
- **FR-011**: System MUST present all extracted fields in an editable form; required fields with confidence below threshold MUST be confirmed by the user before rights are computed.
- **FR-012**: System MUST produce a plain-language explanation of the denial at Grade-8 reading level or lower, ≤ 120 words, with inline definitions of any term from a maintained glossary.
- **FR-013**: System MUST NOT fabricate any field value; unknown values are shown as unknown.

**Rules & rights**
- **FR-020**: System MUST ask, at most, these questions: state (pre-filled), plan source (employer / Marketplace / bought directly / other), self-funded status (yes / no / don't know), was the care an emergency or at an in-network facility (yes / no / don't know), is the treatment ongoing or urgent (yes / no).
- **FR-021**: System MUST compute applicable protections and deadlines deterministically from a versioned rules dataset, given (state, plan source, self-funded, denial category, emergency flag, urgency flag, anchor dates). The language model MUST NOT decide which rules apply.
- **FR-022**: Every rule in the dataset MUST carry: jurisdiction, plain-language summary, legal reference, `source_url`, `last_verified` date, and the computation it drives (if any).
- **FR-023**: System MUST display each applicable protection with its "why this applies" line and source link, ordered by relevance to the denial category.
- **FR-024**: System MUST show deadlines as a date, a days-remaining count, the anchor date, and the rule used; and MUST handle the "letter says a different deadline" cases as described in Edge Cases.
- **FR-025**: For unsupported states, system MUST apply the federal baseline only and link to that state's insurance regulator.

**Letter**
- **FR-030**: System MUST generate an appeal letter draft using only extracted facts, user answers, and the computed rights; unknown facts MUST appear as visible placeholders.
- **FR-031**: The letter MUST include: request for the full claim file and the specific clinical criteria/guidelines relied upon; a request for a written decision within the applicable timeframe; and the argument template matched to the denial category.
- **FR-032**: Users MUST be able to edit the letter in place and download it as a printable PDF or copy it as text.
- **FR-033**: System MUST show an attachment checklist and a where-to-send block alongside the letter.

**Framing & trust**
- **FR-040**: Every screen that displays a generated statement about rights or deadlines MUST label it as AI-assisted information and MUST NOT use prescriptive language ("you should", "you must", "you will win").
- **FR-041**: The landing page MUST show, above the fold on a 375-px viewport: what the tool does, that it is not legal advice, and that documents are not stored.
- **FR-042**: Every screen MUST expose a "Get free human help" entry that resolves to the state Consumer Assistance Program or regulator for the selected state (federal fallback otherwise).

**Privacy & operations**
- **FR-050**: System MUST NOT persist uploaded documents, extracted fields, or generated letters server-side beyond the lifetime of the request. Session state lives in the user's browser only.
- **FR-051**: No credentials or API keys in source; configuration via environment variables; a repository check MUST fail on common key patterns.
- **FR-052**: Sample documents MUST be synthetic, contain no real person's data, and be clearly watermarked "SAMPLE".
- **FR-053**: The deployed application MUST be publicly reachable without login.

**Accessibility & UX**
- **FR-060**: All screens MUST meet WCAG 2.2 AA (contrast, focus order, labels, keyboard operability, screen-reader announcements for async results).
- **FR-061**: Every asynchronous step (upload, extraction, letter generation) MUST show progress with an expected duration and MUST be cancellable.
- **FR-062**: The end-to-end flow MUST be completable on a 375-px-wide screen without horizontal scrolling.

### Key Entities

- **Document**: the uploaded file or chosen sample; type (denial letter | EOB); page count; never persisted.
- **Extraction**: the structured facts read from a Document; each field has value, confidence, and source snippet; `denial_category` is one of the fixed taxonomy values.
- **Situation**: Extraction + the user's answers (state, plan source, self-funded, emergency, urgent, confirmed anchor dates). Input to the rules engine.
- **Rule**: one jurisdiction-scoped protection or deadline with summary, legal reference, source URL, last-verified date, applicability predicate, and optional deadline computation.
- **Rights Result**: ordered list of applicable Rules with "why" lines, plus computed Deadlines (date, days left, anchor, rule id, letter-stated deadline if any, discrepancy flag).
- **Letter Draft**: generated text (sections), placeholders list, cited rule ids, attachment checklist, destination.
- **Help Resource**: state or federal human-help contact (name, phone, URL, what they do).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from landing page to a downloaded letter using a sample in under 5 minutes on a phone, with no instructions.
- **SC-002**: On the bundled fixture set, extraction matches the golden values on ≥ 90% of required fields, and never produces a value for a field that is absent from the document.
- **SC-003**: On the golden (state × plan source × denial category × emergency) table, the rules engine returns exactly the expected protections and deadlines in 100% of cases (it is deterministic; anything less is a bug).
- **SC-004**: 100% of rights/deadline statements shown in the UI carry a source link; 100% of rules in the dataset have a `last_verified` date within 30 days of submission.
- **SC-005**: All explanation text scores at or below Grade 8 on a standard readability index; the letter scores at or below Grade 10.
- **SC-006**: Automated accessibility audit scores ≥ 95 on every screen; the flow is completable by keyboard only and with a screen reader.
- **SC-007**: The deployed URL stays live with the sample flow working even if the model service is down (cached sample results).
- **SC-008**: A reviewer reading the letter draft finds zero prescriptive or outcome-predictive sentences and zero fabricated facts.
- **SC-009**: README lists every library, model, dataset, and AI tool used, and the "not built" list, in full.

## Assumptions

- Users have a modern phone or desktop browser and an internet connection; no offline mode.
- The three supported states are California, New York, and Texas. Rationale: three of the four most populous states; three distinct external-review models; all well documented by their regulators. Florida (federal-process state) is the first v2 candidate precisely because it is the counter-example.
- Federal baseline rules follow the ACA/PHS Act §2719 internal-appeal and external-review framework and the ERISA claims-procedure regulation; the No Surprises Act rules follow the federal implementing regulations. All specific numbers (180 days, 4 months, 72 hours, 30/60-day insurer decision windows, etc.) are to be verified against primary sources during the build and recorded with `last_verified` dates; the spec does not assert them.
- The denial-category taxonomy (8 categories) is fixed for v1; documents that fit none are classified "other" and get the generic appeal template.
- A single language model provider is used for extraction, explanation, and drafting; it is called only from the server.
- Sample documents are authored for this project (synthetic names, IDs, providers, addresses) and visually resemble real letters/EOBs of large US insurers without copying any insurer's branding.
- "Deadline" always means the consumer's filing window; insurer response windows are shown as information, not as clocks.
- The jury evaluates on the deployed site with the samples; live uploads work but are not the primary demo path.

## Open Questions for Scope Validation

1. **Bill vs. denial**: v1 treats "erroneous medical bill" only through the No Surprises Act
   balance-billing angle inferable from an EOB. Is dropping itemized-bill audit acceptable?
2. **States**: CA / NY / TX proposed. Any reason to swap one (e.g. FL to show the
   federal-process case, or IL)?
3. **Self-funded ERISA plans**: kept in scope because the federal rules cover them and
   "I don't know" is the honest common case. Confirm.
4. **Letter export**: PDF + copy-as-text proposed; DOCX would add a library and little value.
   Confirm.

## Delivery notes (2026-09-19)

All four user stories shipped and are verified end-to-end against the production deployment
(https://overturn-peach.vercel.app). Additions beyond the original spec, made after the first
owner review on a phone:

- A public **home page** (`/`) separate from the flow, which now starts at `/start`. Hero with a
  before/after reading of a sample sentence, KFF 2024 figures, three illustrated steps,
  differentiators, trust panel, call to action.
- **/learn** ("How appeals work"): the four stages of a US appeal, what each covered state adds,
  and a FAQ, all rendered from the same rules dataset the engine uses (FR-022 applies to it).
- **/about**: the problem, the information-vs-advice line, privacy, scope, authorship.
- Progressive disclosure on Understand (6 key facts, 12 more on demand) and Rights (4 rules,
  more on demand); a light/dark switch; step transitions.

Success criteria status: SC-001 to SC-009 met; SC-006 measured as Lighthouse accessibility 100
and zero axe violations on every screen; SC-002 measured on the five supported samples at 100 %
of golden fields. Open scope questions 1–4 were all answered "yes" by the owner on 2026-09-18.
