# Extraction eval — anthropic/claude-opus-5

2026-10-16 · 12 documents · 240 fields scored · cost $0.769

| | Rate |
|---|---|
| Field accuracy | **99.2%** |
| Hallucinations (filled a field the document does not contain) | 2 (0.8%) |
| Misses (left empty a field the document does contain) | 0 (0.0%) |
| Wrong values | 0 (0.0%) |
| Quotes found on the page ("every fact has a receipt") | 100.0% of 238 |

## By field

| Field | Accuracy | Miss | Hallucination | Wrong |
|---|---|---|---|---|
| document_type | 100.0% | 0 | 0 | 0 |
| program_signals | 100.0% | 0 | 0 | 0 |
| insurer_name | 100.0% | 0 | 0 | 0 |
| member_id | 100.0% | 0 | 0 | 0 |
| claim_number | 100.0% | 0 | 0 | 0 |
| letter_date | 100.0% | 0 | 0 | 0 |
| provider_name | 100.0% | 0 | 0 | 0 |
| service_description | 100.0% | 0 | 0 | 0 |
| service_dates | 100.0% | 0 | 0 | 0 |
| denial_category | 100.0% | 0 | 0 | 0 |
| denial_codes | 100.0% | 0 | 0 | 0 |
| amounts.billed | 100.0% | 0 | 0 | 0 |
| amounts.allowed | 83.3% | 0 | 2 | 0 |
| amounts.plan_paid | 100.0% | 0 | 0 | 0 |
| amounts.patient_responsibility | 100.0% | 0 | 0 | 0 |
| network_status | 100.0% | 0 | 0 | 0 |
| emergency_signals | 100.0% | 0 | 0 | 0 |
| urgency_signals | 100.0% | 0 | 0 | 0 |
| stated_appeal_deadline | 100.0% | 0 | 0 | 0 |
| state_hint | 100.0% | 0 | 0 | 0 |

## Traps

Each trap is planted to catch one specific misreading.

| Trap | Targets | Read correctly |
|---|---|---|
| boilerplate_expedited | urgency_signals | 11/11 |
| deadline_as_date | stated_appeal_deadline | 1/1 |
| emergency_visit | emergency_signals | 1/1 |
| insurer_out_of_state | state_hint | 1/1 |
| medicaid_managed_care | program_signals | 1/1 |
| medicare_advantage | program_signals | 1/1 |
| no_deadline | stated_appeal_deadline | 1/1 |
| no_letter_date | letter_date | 1/1 |
| short_deadline | stated_appeal_deadline | 1/1 |
| urgent_case | urgency_signals | 1/1 |
| us_date_format | service_dates | 2/2 |
| vague_owed | amounts.patient_responsibility | 2/2 |

## By denial category

| Category | Accuracy |
|---|---|
| coding_admin | 100.0% |
| experimental | 100.0% |
| medical_necessity | 98.3% |
| not_covered | 100.0% |
| out_of_network | 97.5% |
| prior_auth | 100.0% |
| timely_filing | 100.0% |

## By document type

| Type | Accuracy |
|---|---|
| letter | 98.8% |
| eob | 100.0% |

## Every error

| Case | Field | Verdict | Expected | Got |
|---|---|---|---|---|
| eval-001-medical-necessity-letter | amounts.allowed | hallucination | — | `0` |
| eval-011-out-of-network-letter | amounts.allowed | hallucination | — | `0` |
