# Data Model: Denial & Bill Appeal Assistant

All types are Zod schemas in `lib/schemas/` and `lib/rules/schema.ts`; TypeScript types are inferred.
Nothing here is persisted server-side.

## Field<T>
Wrapper used for every extracted value.
```
{ value: T | null, confidence: 0..1, quote: string | null, page: number | null }
```
Rule: `value === null` is the only allowed representation of "not in the document". The model
schema forbids free-text "unknown"/"N/A" values (enum-validated where possible).

## DenialCategory (enum)
`medical_necessity | prior_auth | out_of_network | not_covered | coding_admin | experimental | timely_filing | duplicate | other`

## Extraction
```
document_type:        Field<"denial_letter" | "eob" | "other">
program_signals:      Field<"commercial" | "medicare" | "medicaid" | "tricare" | "unknown">  // gate for unsupported
insurer_name:         Field<string>
member_id:            Field<string>
claim_number:         Field<string>
letter_date:          Field<ISODate>              // anchor for deadlines
provider_name:        Field<string>
service_description:  Field<string>
service_dates:        Field<ISODate[]>
denial_category:      Field<DenialCategory>
denial_reason_quote:  Field<string>               // verbatim
denial_codes:         Field<string[]>             // CARC/RARC or plan codes if present
amounts: { billed, allowed, plan_paid, patient_responsibility }: Field<number>
network_status:       Field<"in_network" | "out_of_network" | "unknown">
emergency_signals:    Field<boolean>              // "emergency", "ER", "ambulance"…
urgency_signals:      Field<boolean>              // ongoing treatment, inpatient, "urgent"
stated_appeal_deadline: Field<ISODate | { days: number }>
stated_appeal_address:  Field<string>
stated_appeal_instructions: Field<string>
state_hint:           Field<USStateCode>          // from member/insurer addresses
```
Required-for-rights fields: `letter_date`, `denial_category`, `state_hint` (confirmable), `document_type`.
Confidence threshold for auto-accept: 0.75; below → UI forces confirmation.

## Explanation
```
{ summary: string (≤120 words), grade_level: number, terms: [{ term, definition }] }
```

## Situation  (= confirmed Extraction + answers)
```
extraction:    Extraction (post-confirmation values)
state:         USStateCode
plan_source:   "employer" | "marketplace" | "direct" | "other"
self_funded:   "yes" | "no" | "unknown"
emergency:     "yes" | "no" | "unknown"
urgent:        "yes" | "no"
anchor_dates:  { letter_date: ISODate, final_internal_denial_date?: ISODate }
today:         ISODate   // injected, for testability
```

## Rule  (dataset item)
```
id:            string  (e.g. "fed.internal_appeal.filing_window")
jurisdiction:  "federal" | "nsa" | "CA" | "NY" | "TX"
category:      "deadline" | "protection" | "right" | "process"
title:         string
summary:       string   // plain English, ≤ 60 words
legal_ref:     string   // e.g. "45 CFR 147.136(b)(3)(ii)(E)"
source_url:    URL
last_verified: ISODate  // test fails if > 45 days before build date
applies_if: {
  state?: USStateCode[]            // omit = any
  plan_source?: PlanSource[]
  self_funded?: "yes" | "no" | "unknown" | "any"   // "unknown" means: show, with caveat
  denial_category?: DenialCategory[]
  emergency?: boolean
  urgent?: boolean
  document_type?: ("denial_letter" | "eob")[]
}
deadline?: {
  anchor: "letter_date" | "final_internal_denial_date" | "service_date"
  amount: number
  unit: "days" | "months" | "hours"
  who: "consumer" | "insurer"      // only consumer deadlines get a clock
}
priority:      number   // lower = shown first within its group
why_template:  string   // "Because your plan is {plan_source} and the denial is about {denial_category}…"
caveat?:       string   // shown when self_funded === "unknown", etc.
```

## RightsResult  (engine output; pure function of Situation)
```
rules:     [{ rule: Rule, why: string, caveat?: string }]          // ordered
deadlines: [{
  rule_id, label, due: ISODate, days_left: number, anchor: ISODate, anchor_label,
  status: "ok" | "soon" (≤30d) | "urgent" (≤7d) | "passed",
  letter_stated?: ISODate, discrepancy?: "letter_shorter" | "letter_longer"
}]
route:     "federal_only" | "state_overlay"
help:      HelpResource[]
unsupported_note?: string     // for states outside CA/NY/TX
```

## LetterDraft
```
sections:      [{ id: "header" | "re" | "intro" | "facts" | "argument" | "requests" | "closing", heading?, text }]
placeholders:  string[]                 // every "[ADD: …]" found
cited_rule_ids: string[]                // must ⊆ RightsResult.rules[].rule.id  (guard)
checklist:     [{ item: string, why: string }]
send_to:       { address: string | null, source: "letter" | "generic", verify_note: string }
guard_report:  { prescriptive_hits: string[], unknown_citations: string[], regenerated: boolean }
```

## HelpResource
```
{ id, scope: "federal" | USStateCode, name, kind: "CAP" | "regulator" | "ombudsman" | "helpdesk",
  phone?, url, what_they_do: string }
```

## State transitions (client)
`idle → extracting → needs_confirmation | unsupported | error → confirmed → answered → drafting → drafted`
Back navigation is always allowed; forward requires the previous state.
