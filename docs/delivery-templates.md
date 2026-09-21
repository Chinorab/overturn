# Delivery templates — the email and the one-page summary (content for T020)

What the person receives after saying "yes, send it". Two PDF attachments (the letter, as the
web app already renders it with `@react-pdf/renderer`; and this new one-page **summary**) and an
email whose body is short enough to read on a phone. Everything below is copy and layout; the
code in `lib/delivery/summary-pdf.tsx` and `lib/delivery/email.ts` renders it from the case:
`LetterDraft` (sections, placeholders, checklist, send_to, cited_rule_ids), `RightsResult`
(deadlines, applied rules with sources), the help resources, and the delivery metadata.

Rules that apply to both artefacts (Constitution I and IV, LEGAL_DESIGN addendum):

- Descriptive, second person, no "you should / must". Facts and rules only from the case.
- Every deadline shows its date, days remaining at send time, anchor date and rule; every
  protection shows its legal reference, source link and last-verified date.
- Nothing from the uploaded document is attached or quoted beyond the facts already in the letter.
- The recipient is the linked-account address; the email never mentions any other address.
- "Information, not legal advice" appears in the email footer and on the summary page.

Placeholders use `{…}`; the code fills them or omits the line when the value is absent.

---

## 1. Email

**From:** `Overturn <{SES_FROM}>` — display name "Overturn", never a person's name.
**To:** `{account.email}` only. No CC, no BCC, no reply-to other than `{SES_FROM}`.
**Subject:** `Your appeal letter — {insurer_name}, denial dated {letter_date_long}`
(no-document path: `Your appeal letter draft — denial from about {approx_date_long}`)

**Attachments:**
1. `Overturn-appeal-letter-{YYYY-MM-DD}.pdf` — the letter
2. `Overturn-summary-{YYYY-MM-DD}.pdf` — the one-page summary

### Plain-text body (also the fallback for clients without HTML)

```
Hi,

Here is the appeal letter you asked for by voice, and a one-page summary of your
deadlines and the protections that apply. Both are attached as PDFs.

FIRST DEADLINE
{first_deadline.label}: {first_deadline.date_long} — {first_deadline.days_remaining} days
from today. Counted from {first_deadline.anchor_label} ({first_deadline.anchor_date_long}),
under {first_deadline.rule_title} ({first_deadline.legal_ref}).
{if approximate: "This date is an estimate based on the date you gave; the exact date on your
letter replaces it."}

BEFORE YOU SEND
The letter is your draft. It has {placeholders.count} blanks marked [ADD: …] for things only
you know — {placeholders.first_three_joined}. Read the whole letter once, fill the blanks,
sign it, and keep a copy.

WHAT TO ATTACH
{for each checklist item: "- {item}"}

WHERE TO SEND IT
{send_to.address}
{send_to.verify_note}

FREE HUMAN HELP
{for each help resource (state first, then federal, max 3): "- {name}: {phone} — {url}"}
They can look at your letter with you at no cost.

WHAT WE KEPT
Nothing. Your document and this conversation were held in memory only and are gone. This
email is the only copy; it was sent to the address on the account you linked and to no one else.

— Overturn

Overturn gives information, not legal advice. It explains what a document says and what
rules generally apply; it does not tell you what to do or predict the outcome. Rules come from
a verified dataset with a source and a date for each; the letter was written with AI from
your facts and those rules only. {SIM_BASE_URL}/about
```

### HTML body

Same content, same order, in the web app's visual language (Public Sans, calm civic palette,
one column, ≤ 600 px wide, no images that carry meaning, no tracking pixel, no external
stylesheet). Structure:

| Block | Rendering |
|---|---|
| Greeting + one-line purpose | paragraph |
| **First deadline** | a bordered card: date in large type, days remaining beneath, then a small line "counted from … under … ({legal_ref}) · [source]({source_url}) · verified {last_verified}"; if approximate, an amber note line |
| **Before you send** | paragraph + the first three blanks as a short list |
| **What to attach** | checklist as a list; each item's `why` in smaller grey text under it |
| **Where to send it** | address block (monospace) + verify note in italics |
| **Free human help** | list; phone as `tel:` link, name as link to `url` |
| **What we kept** | paragraph |
| Footer | the information-not-advice text, grey, 12 px, link to `/about` |

Inline CSS only; tested in Gmail (web + iOS), Apple Mail, Outlook web. Dark-mode safe (no pure
white backgrounds on cards; text colours with ≥ 4.5:1 on both).

### Failure email — not sent

If SES fails, nothing is emailed; the assistant says so and gives the download link. There is no
"we tried to email you" message, because it would be sent by the same failing channel.

### Medicare / unsupported help card (transcript `unsupported-medicare-sample06`)

A different, shorter email with no attachments:
subject `Where to appeal a Medicare decision — links from Overturn`; body = one paragraph
("The notice you showed me is a Medicare Advantage decision, which Overturn does not cover…"),
then Medicare's own appeals page, 1-800-MEDICARE, the state SHIP counselling program for
`{state}`, and the same footer.

---

## 2. Summary PDF — one page, US Letter, portrait

Rendered with `@react-pdf/renderer` like the letter, same fonts. Fits **one page** at 11 pt with
up to 3 deadlines, 6 protections, 6 checklist items; beyond that the code truncates protections
to the first 6 by priority and says "and {n} more in the letter's references". Layout, top to
bottom:

```
┌────────────────────────────────────────────────────────────────────────┐
│ OVERTURN · Appeal summary                       Prepared {date_long}   │
│ Information, not legal advice.                  Case {code} · kept: nothing │
├────────────────────────────────────────────────────────────────────────┤
│ YOUR DENIAL                                                            │
│ {insurer_name} · {service_description} · service {service_date_long}   │
│ Denial dated {letter_date_long} · reason: "{denial_reason_short}"      │
│ Amount billed {amount_billed} · plan paid {amount_plan_paid}           │
│ (no-document path: "From what you told me: {state}, {plan_source},     │
│  {denial_category_label}, letter around {approx_date_long}")           │
├────────────────────────────────────────────────────────────────────────┤
│ DEADLINES                                                              │
│ ● {date_long}   {days} days    {label}                                 │
│   from {anchor_label} {anchor_date}  ·  {rule_title} ({legal_ref})     │
│   {source_url}  ·  verified {last_verified}     [approximate ⚠ if so]  │
│ ○ {next deadline, same shape — external review anchored on the final   │
│   internal denial shows "after the plan's final decision" not a date}  │
├────────────────────────────────────────────────────────────────────────┤
│ WHAT APPLIES TO YOU                       (ordered as the engine does)  │
│ {title}                                                                │
│   {summary}   Why: {why_applies}   {caveat if any}                     │
│   {legal_ref} · {source_url} · verified {last_verified}                │
│ … up to 6                                                              │
├────────────────────────────────────────────────────────────────────────┤
│ WHAT TO ATTACH                  │ WHERE TO SEND IT                     │
│ ☐ {item}                        │ {send_to.address}                    │
│   {why}                         │ {send_to.verify_note}                │
│ ☐ …                             │                                      │
│                                 │ FREE HUMAN HELP                      │
│                                 │ {name} · {phone} · {url}             │
│                                 │ {name} · {phone} · {url}             │
├────────────────────────────────────────────────────────────────────────┤
│ The letter attached is your draft: fill the [ADD: …] blanks, read it   │
│ once, sign it, keep a copy. Rules from a verified dataset, one source  │
│ and one date per rule (us-health-appeal-rules v{RULES_VERSION}).       │
│ Written with AI from your facts and those rules only. {about_url}      │
└────────────────────────────────────────────────────────────────────────┘
```

Typography and colour: same tokens as the web app's letter PDF (Fraunces for the two headings
"Overturn · Appeal summary" and section titles in small caps, Public Sans for the body; ink
`#1c1c1c`, rule lines `#c9c4bb`, the deadline dot in the app's accent). Deadline dates and day
counts are the only bold text on the page — the eye must land there first, as on the Understand
screen.

Accessibility of the PDF: tagged headings, reading order = visual order, links as real link
annotations, document title "Overturn appeal summary — {date}", language `en-US`.

### Data → template mapping (for `summary-pdf.tsx`)

| Field on the page | From |
|---|---|
| `insurer_name`, `service_description`, `service_date`, `letter_date`, `denial_reason_short`, amounts | `Extraction` (confirmed) — `denial_reason_short` = first sentence of `denial_reason_quote`, ≤ 140 chars |
| no-document line | `Answers` + `approxDocumentDate` |
| deadlines (date, days, anchor, rule, source, verified, approximate) | `RightsResult.deadlines` (+ `approximate` flag from the case) — `days` computed at send time |
| protections (title, summary, why, caveat, legal_ref, source_url, last_verified) | `RightsResult.applied` in engine order |
| checklist, send_to | `LetterDraft.checklist`, `LetterDraft.send_to` |
| help resources | `RightsResult.help` (state first, then federal; max 3) |
| `RULES_VERSION` | `data/rules/RULES_VERSION` |
| `code`, `date_long` | `Case.code`, send time |

### What is deliberately not on the page

- No verbatim quote from the document beyond the short reason; no member ID, claim number,
  address of the person — those are in the letter, which is theirs.
- No probability, no "chances", no "strong case".
- No transcript of the conversation.

---

## 3. Tests to write with the code (T020)

- Snapshot of the plain-text email for samples 02 and 01 and for the TX no-document case;
  assertion that no `[ADD:` appears in the email body (blanks belong in the letter), that every
  deadline line contains a `verified` date, and that the body has no `guard.ts` hits.
- The summary PDF renders to **one page** for the six text samples and for the no-document case
  (count pages with `pdfjs-dist`), and its text layer contains every applied rule's `legal_ref`.
- `email.ts`: recipient is always `account.email`; a unit test proves a different `to` cannot
  be injected (there is no parameter); SES client mocked; failure → `delivery_failed` error, no
  retry with a different address.
