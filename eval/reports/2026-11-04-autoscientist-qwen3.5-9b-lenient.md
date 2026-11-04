# AutoScientist reader (Qwen3.5-9B + LoRA) — 2026-11-04 — lenient parsing

Text of each document in, extraction JSON out, greedy decoding, on a Hugging Face L40S job.

## Mode `tuned-chat`

Valid extraction JSON: 66/67. About 11.4 s per document (batched).

2026-11-04 · 60 documents · 1200 fields scored · cost see the job's bill

| | Rate |
|---|---|
| Field accuracy | **94.8%** |
| Hallucinations (filled a field the document does not contain) | 3 (0.3%) |
| Misses (left empty a field the document does contain) | 54 (4.5%) |
| Wrong values | 5 (0.4%) |
| Quotes found on the page ("every fact has a receipt") | 100.0% of 1113 |

## By field

| Field | Accuracy | Miss | Hallucination | Wrong |
|---|---|---|---|---|
| document_type | 93.3% | 2 | 0 | 2 |
| program_signals | 100.0% | 0 | 0 | 0 |
| insurer_name | 95.0% | 3 | 0 | 0 |
| member_id | 96.7% | 2 | 0 | 0 |
| claim_number | 91.7% | 5 | 0 | 0 |
| letter_date | 93.3% | 4 | 0 | 0 |
| provider_name | 98.3% | 1 | 0 | 0 |
| service_description | 91.7% | 5 | 0 | 0 |
| service_dates | 91.7% | 5 | 0 | 0 |
| denial_category | 96.7% | 2 | 0 | 0 |
| denial_codes | 95.0% | 3 | 0 | 0 |
| amounts.billed | 95.0% | 3 | 0 | 0 |
| amounts.allowed | 96.7% | 2 | 0 | 0 |
| amounts.plan_paid | 95.0% | 3 | 0 | 0 |
| amounts.patient_responsibility | 90.0% | 3 | 3 | 0 |
| network_status | 98.3% | 1 | 0 | 0 |
| emergency_signals | 100.0% | 0 | 0 | 0 |
| urgency_signals | 100.0% | 0 | 0 | 0 |
| stated_appeal_deadline | 86.7% | 8 | 0 | 0 |
| state_hint | 91.7% | 2 | 0 | 3 |

## Traps

Each trap is planted to catch one specific misreading.

| Trap | Targets | Read correctly |
|---|---|---|
| boilerplate_expedited | urgency_signals | 55/55 |
| deadline_as_date | stated_appeal_deadline | 0/5 |
| emergency_visit | emergency_signals | 5/5 |
| insurer_out_of_state | state_hint | 1/5 |
| medicaid_managed_care | program_signals | 5/5 |
| medicare_advantage | program_signals | 5/5 |
| no_deadline | stated_appeal_deadline | 5/5 |
| no_letter_date | letter_date | 5/5 |
| short_deadline | stated_appeal_deadline | 5/5 |
| urgent_case | urgency_signals | 5/5 |
| us_date_format | service_dates | 10/10 |
| vague_owed | amounts.patient_responsibility | 7/10 |

## By denial category

| Category | Accuracy |
|---|---|
| coding_admin | 97.9% |
| duplicate | 75.0% |
| experimental | 99.3% |
| medical_necessity | 94.6% |
| not_covered | 95.0% |
| out_of_network | 95.5% |
| prior_auth | 97.5% |
| timely_filing | 95.0% |

## By document type

| Type | Accuracy |
|---|---|
| letter | 95.8% |
| eob | 93.0% |

## Every error

| Case | Field | Verdict | Expected | Got |
|---|---|---|---|---|
| eval-002-prior-auth-letter | amounts.patient_responsibility | hallucination | — | `0` |
| eval-004-not-covered-letter | letter_date | miss | `"2026-10-01"` | — |
| eval-004-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-30"}` | — |
| eval-008-medical-necessity-letter | service_dates | miss | `["2026-09-02"]` | — |
| eval-009-medical-necessity-eob | state_hint | wrong | `"CA"` | `"TX"` |
| eval-010-prior-auth-letter | insurer_name | miss | `"Quillfield Health Plan"` | — |
| eval-010-prior-auth-letter | claim_number | miss | `"CLM-26-7458-95184"` | — |
| eval-015-timely-filing-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-016-duplicate-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-25"}` | — |
| eval-019-out-of-network-letter | claim_number | miss | `"CLM-26-1246-35794"` | — |
| eval-020-medical-necessity-letter | service_dates | miss | `["2026-08-30"]` | — |
| eval-021-coding-admin-eob | document_type | wrong | `"eob"` | `"denial_letter"` |
| eval-024-duplicate-eob | document_type | miss | `"eob"` | — |
| eval-024-duplicate-eob | letter_date | miss | `"2026-08-09"` | — |
| eval-024-duplicate-eob | service_description | miss | `"Comprehensive metabolic panel and lipid panel"` | — |
| eval-024-duplicate-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-028-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2026-12-30"}` | — |
| eval-031-timely-filing-letter | claim_number | miss | `"CLM-26-6180-04638"` | — |
| eval-032-medical-necessity-letter | service_dates | miss | `["2026-09-21"]` | — |
| eval-033-medical-necessity-eob | state_hint | wrong | `"CA"` | `"GA"` |
| eval-038-experimental-letter | amounts.patient_responsibility | hallucination | — | `0` |
| eval-040-duplicate-letter | document_type | miss | `"denial_letter"` | — |
| eval-040-duplicate-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-040-duplicate-letter | member_id | miss | `"TAM-186290-38"` | — |
| eval-040-duplicate-letter | claim_number | miss | `"CLM-26-2938-02714"` | — |
| eval-040-duplicate-letter | letter_date | miss | `"2026-09-03"` | — |
| eval-040-duplicate-letter | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-040-duplicate-letter | service_description | miss | `"MRI of the left knee without contrast"` | — |
| eval-040-duplicate-letter | service_dates | miss | `["2026-07-20"]` | — |
| eval-040-duplicate-letter | denial_category | miss | `"duplicate"` | — |
| eval-040-duplicate-letter | denial_codes | miss | `["CO-18"]` | — |
| eval-040-duplicate-letter | amounts.billed | miss | `2441.63` | — |
| eval-040-duplicate-letter | amounts.plan_paid | miss | `0` | — |
| eval-040-duplicate-letter | amounts.patient_responsibility | miss | `2441.63` | — |
| eval-040-duplicate-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-02"}` | — |
| eval-040-duplicate-letter | state_hint | miss | `"GA"` | — |
| eval-044-medical-necessity-letter | service_dates | miss | `["2026-08-24"]` | — |
| eval-045-coding-admin-eob | service_description | miss | `"Vitamin D, 25-hydroxy level"` | — |
| eval-045-coding-admin-eob | state_hint | wrong | `"IL"` | `"PA"` |
| eval-050-prior-auth-letter | amounts.patient_responsibility | hallucination | — | `0` |
| eval-051-out-of-network-eob | document_type | wrong | `"eob"` | `"denial_letter"` |
| eval-051-out-of-network-eob | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-051-out-of-network-eob | denial_category | miss | `"out_of_network"` | — |
| eval-051-out-of-network-eob | denial_codes | miss | `["CO-242"]` | — |
| eval-051-out-of-network-eob | amounts.billed | miss | `1790.89` | — |
| eval-051-out-of-network-eob | amounts.allowed | miss | `582.33` | — |
| eval-051-out-of-network-eob | amounts.plan_paid | miss | `465.86` | — |
| eval-051-out-of-network-eob | amounts.patient_responsibility | miss | `1325.03` | — |
| eval-052-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-07"}` | — |
| eval-055-timely-filing-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-055-timely-filing-letter | member_id | miss | `"OST-044944-57"` | — |
| eval-055-timely-filing-letter | claim_number | miss | `"CLM-26-5165-65229"` | — |
| eval-057-medical-necessity-eob | denial_codes | miss | `["CO-50"]` | — |
| eval-057-medical-necessity-eob | amounts.billed | miss | `13789.85` | — |
| eval-057-medical-necessity-eob | amounts.allowed | miss | `0` | — |
| eval-057-medical-necessity-eob | amounts.plan_paid | miss | `0` | — |
| eval-057-medical-necessity-eob | amounts.patient_responsibility | miss | `13789.85` | — |
| eval-057-medical-necessity-eob | network_status | miss | `"in_network"` | — |
| eval-057-medical-necessity-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-057-medical-necessity-eob | state_hint | miss | `"CA"` | — |
| eval-060-not-covered-eob | letter_date | miss | `"2026-07-18"` | — |
| eval-060-not-covered-eob | service_description | miss | `"Vitamin D, 25-hydroxy level"` | — |


### Hand-written samples, against Claude's reading

| Sample | Fields that agree |
|---|---|
| 01-medical-necessity-ny | 19/19 |
| 02-prior-auth-ca | 18/19 · stated_appeal_deadline (miss) |
| 03-oon-emergency-tx-eob | 15/19 · letter_date (miss), provider_name (miss), denial_codes (wrong), urgency_signals (hallucination) |
| 04-not-covered-fl | 18/19 · amounts.plan_paid (miss) |
| 05-coding-error-ny-eob | 17/19 · letter_date (miss), state_hint (miss) |
| 06-medicare-unsupported | program read as **medicare** (Overturn stops on Medicare) |
| 07-experimental-ca-photo | 17/19 · service_dates (miss), stated_appeal_deadline (miss) |

