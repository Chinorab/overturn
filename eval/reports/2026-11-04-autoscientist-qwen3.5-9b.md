# AutoScientist reader (Qwen3.5-9B + LoRA) — 2026-11-04

Text of each document in, extraction JSON out, greedy decoding, on a Hugging Face L40S job.

## Mode `tuned-chat`

Valid extraction JSON: 16/67. About 11.4 s per document (batched).

2026-11-04 · 60 documents · 1200 fields scored · cost see the job's bill

| | Rate |
|---|---|
| Field accuracy | **40.3%** |
| Hallucinations (filled a field the document does not contain) | 1 (0.1%) |
| Misses (left empty a field the document does contain) | 713 (59.4%) |
| Wrong values | 2 (0.2%) |
| Quotes found on the page ("every fact has a receipt") | 100.0% of 294 |

## By field

| Field | Accuracy | Miss | Hallucination | Wrong |
|---|---|---|---|---|
| document_type | 25.0% | 45 | 0 | 0 |
| program_signals | 85.0% | 9 | 0 | 0 |
| insurer_name | 25.0% | 45 | 0 | 0 |
| member_id | 25.0% | 45 | 0 | 0 |
| claim_number | 25.0% | 45 | 0 | 0 |
| letter_date | 33.3% | 40 | 0 | 0 |
| provider_name | 25.0% | 45 | 0 | 0 |
| service_description | 25.0% | 45 | 0 | 0 |
| service_dates | 25.0% | 45 | 0 | 0 |
| denial_category | 25.0% | 45 | 0 | 0 |
| denial_codes | 25.0% | 45 | 0 | 0 |
| amounts.billed | 25.0% | 45 | 0 | 0 |
| amounts.allowed | 73.3% | 16 | 0 | 0 |
| amounts.plan_paid | 25.0% | 45 | 0 | 0 |
| amounts.patient_responsibility | 35.0% | 38 | 1 | 0 |
| network_status | 65.0% | 21 | 0 | 0 |
| emergency_signals | 95.0% | 3 | 0 | 0 |
| urgency_signals | 93.3% | 4 | 0 | 0 |
| stated_appeal_deadline | 30.0% | 42 | 0 | 0 |
| state_hint | 21.7% | 45 | 0 | 2 |

## Traps

Each trap is planted to catch one specific misreading.

| Trap | Targets | Read correctly |
|---|---|---|
| boilerplate_expedited | urgency_signals | 55/55 |
| deadline_as_date | stated_appeal_deadline | 0/5 |
| emergency_visit | emergency_signals | 2/5 |
| insurer_out_of_state | state_hint | 0/5 |
| medicaid_managed_care | program_signals | 1/5 |
| medicare_advantage | program_signals | 0/5 |
| no_deadline | stated_appeal_deadline | 5/5 |
| no_letter_date | letter_date | 5/5 |
| short_deadline | stated_appeal_deadline | 2/5 |
| urgent_case | urgency_signals | 1/5 |
| us_date_format | service_dates | 2/10 |
| vague_owed | amounts.patient_responsibility | 9/10 |

## By denial category

| Category | Accuracy |
|---|---|
| coding_admin | 22.1% |
| duplicate | 20.0% |
| experimental | 24.3% |
| medical_necessity | 68.1% |
| not_covered | 20.0% |
| out_of_network | 33.5% |
| prior_auth | 71.9% |
| timely_filing | 20.0% |

## By document type

| Type | Accuracy |
|---|---|
| letter | 43.8% |
| eob | 33.5% |

## Every error

| Case | Field | Verdict | Expected | Got |
|---|---|---|---|---|
| eval-002-prior-auth-letter | document_type | miss | `"denial_letter"` | — |
| eval-002-prior-auth-letter | insurer_name | miss | `"Brightmoor Benefit Solutions"` | — |
| eval-002-prior-auth-letter | member_id | miss | `"BRI-005122-50"` | — |
| eval-002-prior-auth-letter | claim_number | miss | `"CLM-26-5844-01663"` | — |
| eval-002-prior-auth-letter | letter_date | miss | `"2026-09-04"` | — |
| eval-002-prior-auth-letter | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-002-prior-auth-letter | service_description | miss | `"MRI of the lumbar spine without contrast"` | — |
| eval-002-prior-auth-letter | service_dates | miss | `["2026-07-31"]` | — |
| eval-002-prior-auth-letter | denial_category | miss | `"prior_auth"` | — |
| eval-002-prior-auth-letter | denial_codes | miss | `["CO-197"]` | — |
| eval-002-prior-auth-letter | amounts.billed | miss | `3222.07` | — |
| eval-002-prior-auth-letter | amounts.plan_paid | miss | `0` | — |
| eval-002-prior-auth-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-002-prior-auth-letter | state_hint | miss | `"NY"` | — |
| eval-003-out-of-network-eob | document_type | miss | `"eob"` | — |
| eval-003-out-of-network-eob | insurer_name | miss | `"Calloway Health Network"` | — |
| eval-003-out-of-network-eob | member_id | miss | `"CAL-382636-91"` | — |
| eval-003-out-of-network-eob | claim_number | miss | `"CLM-26-4858-89407"` | — |
| eval-003-out-of-network-eob | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-003-out-of-network-eob | service_description | miss | `"MRI of the left knee without contrast"` | — |
| eval-003-out-of-network-eob | service_dates | miss | `["2026-09-28"]` | — |
| eval-003-out-of-network-eob | denial_category | miss | `"out_of_network"` | — |
| eval-003-out-of-network-eob | denial_codes | miss | `["CO-242"]` | — |
| eval-003-out-of-network-eob | amounts.billed | miss | `2400.71` | — |
| eval-003-out-of-network-eob | amounts.allowed | miss | `1057.38` | — |
| eval-003-out-of-network-eob | amounts.plan_paid | miss | `845.9` | — |
| eval-003-out-of-network-eob | amounts.patient_responsibility | miss | `1554.81` | — |
| eval-003-out-of-network-eob | network_status | miss | `"out_of_network"` | — |
| eval-003-out-of-network-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-003-out-of-network-eob | state_hint | miss | `"TX"` | — |
| eval-004-not-covered-letter | document_type | miss | `"denial_letter"` | — |
| eval-004-not-covered-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-004-not-covered-letter | member_id | miss | `"OST-012128-83"` | — |
| eval-004-not-covered-letter | claim_number | miss | `"CLM-26-7048-74989"` | — |
| eval-004-not-covered-letter | letter_date | miss | `"2026-10-01"` | — |
| eval-004-not-covered-letter | provider_name | miss | `"Summitview Family Medicine"` | — |
| eval-004-not-covered-letter | service_description | miss | `"Polysomnography sleep study"` | — |
| eval-004-not-covered-letter | service_dates | miss | `["2026-09-15"]` | — |
| eval-004-not-covered-letter | denial_category | miss | `"not_covered"` | — |
| eval-004-not-covered-letter | denial_codes | miss | `["CO-96"]` | — |
| eval-004-not-covered-letter | amounts.billed | miss | `3582.37` | — |
| eval-004-not-covered-letter | amounts.plan_paid | miss | `0` | — |
| eval-004-not-covered-letter | amounts.patient_responsibility | miss | `3582.37` | — |
| eval-004-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-30"}` | — |
| eval-004-not-covered-letter | state_hint | miss | `"FL"` | — |
| eval-005-coding-admin-letter | document_type | miss | `"denial_letter"` | — |
| eval-005-coding-admin-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-005-coding-admin-letter | member_id | miss | `"HOL-508230-88"` | — |
| eval-005-coding-admin-letter | claim_number | miss | `"CLM-26-2187-93703"` | — |
| eval-005-coding-admin-letter | letter_date | miss | `"2026-07-19"` | — |
| eval-005-coding-admin-letter | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-005-coding-admin-letter | service_description | miss | `"CT scan of the chest with contrast"` | — |
| eval-005-coding-admin-letter | service_dates | miss | `["2026-06-10"]` | — |
| eval-005-coding-admin-letter | denial_category | miss | `"coding_admin"` | — |
| eval-005-coding-admin-letter | denial_codes | miss | `["CO-16"]` | — |
| eval-005-coding-admin-letter | amounts.billed | miss | `1244.09` | — |
| eval-005-coding-admin-letter | amounts.plan_paid | miss | `0` | — |
| eval-005-coding-admin-letter | amounts.patient_responsibility | miss | `1244.09` | — |
| eval-005-coding-admin-letter | stated_appeal_deadline | miss | `{"kind":"days","days":60}` | — |
| eval-005-coding-admin-letter | state_hint | miss | `"IL"` | — |
| eval-006-experimental-eob | document_type | miss | `"eob"` | — |
| eval-006-experimental-eob | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-006-experimental-eob | member_id | miss | `"TAM-938618-50"` | — |
| eval-006-experimental-eob | claim_number | miss | `"CLM-26-8154-48011"` | — |
| eval-006-experimental-eob | letter_date | miss | `"2026-08-26"` | — |
| eval-006-experimental-eob | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-006-experimental-eob | service_description | miss | `"Transcranial magnetic stimulation (TMS) treatment course"` | — |
| eval-006-experimental-eob | service_dates | miss | `["2026-07-27"]` | — |
| eval-006-experimental-eob | denial_category | miss | `"experimental"` | — |
| eval-006-experimental-eob | denial_codes | miss | `["CO-55"]` | — |
| eval-006-experimental-eob | amounts.billed | miss | `7398.27` | — |
| eval-006-experimental-eob | amounts.allowed | miss | `0` | — |
| eval-006-experimental-eob | amounts.plan_paid | miss | `0` | — |
| eval-006-experimental-eob | amounts.patient_responsibility | miss | `7398.27` | — |
| eval-006-experimental-eob | network_status | miss | `"in_network"` | — |
| eval-006-experimental-eob | state_hint | miss | `"OH"` | — |
| eval-007-timely-filing-letter | document_type | miss | `"denial_letter"` | — |
| eval-007-timely-filing-letter | program_signals | miss | `"medicare"` | — |
| eval-007-timely-filing-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-007-timely-filing-letter | member_id | miss | `"TAM-519369-83"` | — |
| eval-007-timely-filing-letter | claim_number | miss | `"CLM-26-2390-74009"` | — |
| eval-007-timely-filing-letter | letter_date | miss | `"2026-10-14"` | — |
| eval-007-timely-filing-letter | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-007-timely-filing-letter | service_description | miss | `"Vitamin D, 25-hydroxy level"` | — |
| eval-007-timely-filing-letter | service_dates | miss | `["2026-09-03"]` | — |
| eval-007-timely-filing-letter | denial_category | miss | `"timely_filing"` | — |
| eval-007-timely-filing-letter | denial_codes | miss | `["CO-29"]` | — |
| eval-007-timely-filing-letter | amounts.billed | miss | `128.42` | — |
| eval-007-timely-filing-letter | amounts.plan_paid | miss | `0` | — |
| eval-007-timely-filing-letter | amounts.patient_responsibility | miss | `128.42` | — |
| eval-007-timely-filing-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-007-timely-filing-letter | state_hint | miss | `"PA"` | — |
| eval-008-medical-necessity-letter | document_type | miss | `"denial_letter"` | — |
| eval-008-medical-necessity-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-008-medical-necessity-letter | member_id | miss | `"TAM-721643-67"` | — |
| eval-008-medical-necessity-letter | claim_number | miss | `"CLM-26-1296-79404"` | — |
| eval-008-medical-necessity-letter | letter_date | miss | `"2026-10-03"` | — |
| eval-008-medical-necessity-letter | provider_name | miss | `"Summitview Family Medicine"` | — |
| eval-008-medical-necessity-letter | service_description | miss | `"Continued inpatient rehabilitation stay"` | — |
| eval-008-medical-necessity-letter | service_dates | miss | `["2026-09-02"]` | — |
| eval-008-medical-necessity-letter | denial_category | miss | `"medical_necessity"` | — |
| eval-008-medical-necessity-letter | denial_codes | miss | `["CO-50"]` | — |
| eval-008-medical-necessity-letter | amounts.billed | miss | `38729.94` | — |
| eval-008-medical-necessity-letter | amounts.plan_paid | miss | `0` | — |
| eval-008-medical-necessity-letter | amounts.patient_responsibility | miss | `38729.94` | — |
| eval-008-medical-necessity-letter | urgency_signals | miss | `true` | — |
| eval-008-medical-necessity-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-008-medical-necessity-letter | state_hint | miss | `"GA"` | — |
| eval-009-medical-necessity-eob | state_hint | wrong | `"CA"` | `"TX"` |
| eval-010-prior-auth-letter | document_type | miss | `"denial_letter"` | — |
| eval-010-prior-auth-letter | program_signals | miss | `"medicaid"` | — |
| eval-010-prior-auth-letter | insurer_name | miss | `"Quillfield Health Plan"` | — |
| eval-010-prior-auth-letter | member_id | miss | `"QUI-715825-90"` | — |
| eval-010-prior-auth-letter | claim_number | miss | `"CLM-26-7458-95184"` | — |
| eval-010-prior-auth-letter | letter_date | miss | `"2026-08-12"` | — |
| eval-010-prior-auth-letter | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-010-prior-auth-letter | service_description | miss | `"Upper GI endoscopy with biopsy"` | — |
| eval-010-prior-auth-letter | service_dates | miss | `["2026-07-23"]` | — |
| eval-010-prior-auth-letter | denial_category | miss | `"prior_auth"` | — |
| eval-010-prior-auth-letter | denial_codes | miss | `["CO-197"]` | — |
| eval-010-prior-auth-letter | amounts.billed | miss | `3995.42` | — |
| eval-010-prior-auth-letter | amounts.plan_paid | miss | `0` | — |
| eval-010-prior-auth-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-010-prior-auth-letter | state_hint | miss | `"NY"` | — |
| eval-012-not-covered-eob | document_type | miss | `"eob"` | — |
| eval-012-not-covered-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-012-not-covered-eob | member_id | miss | `"HOL-230289-58"` | — |
| eval-012-not-covered-eob | claim_number | miss | `"CLM-26-4327-58562"` | — |
| eval-012-not-covered-eob | letter_date | miss | `"2026-08-11"` | — |
| eval-012-not-covered-eob | provider_name | miss | `"Clearwater Neurology Group"` | — |
| eval-012-not-covered-eob | service_description | miss | `"Polysomnography sleep study"` | — |
| eval-012-not-covered-eob | service_dates | miss | `["2026-07-07"]` | — |
| eval-012-not-covered-eob | denial_category | miss | `"not_covered"` | — |
| eval-012-not-covered-eob | denial_codes | miss | `["CO-96"]` | — |
| eval-012-not-covered-eob | amounts.billed | miss | `2646.85` | — |
| eval-012-not-covered-eob | amounts.allowed | miss | `0` | — |
| eval-012-not-covered-eob | amounts.plan_paid | miss | `0` | — |
| eval-012-not-covered-eob | amounts.patient_responsibility | miss | `2646.85` | — |
| eval-012-not-covered-eob | network_status | miss | `"in_network"` | — |
| eval-012-not-covered-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-012-not-covered-eob | state_hint | miss | `"FL"` | — |
| eval-013-coding-admin-letter | document_type | miss | `"denial_letter"` | — |
| eval-013-coding-admin-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-013-coding-admin-letter | member_id | miss | `"TAM-174919-00"` | — |
| eval-013-coding-admin-letter | claim_number | miss | `"CLM-26-9125-74685"` | — |
| eval-013-coding-admin-letter | letter_date | miss | `"2026-09-21"` | — |
| eval-013-coding-admin-letter | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-013-coding-admin-letter | service_description | miss | `"Comprehensive metabolic panel and lipid panel"` | — |
| eval-013-coding-admin-letter | service_dates | miss | `["2026-09-04"]` | — |
| eval-013-coding-admin-letter | denial_category | miss | `"coding_admin"` | — |
| eval-013-coding-admin-letter | denial_codes | miss | `["CO-16"]` | — |
| eval-013-coding-admin-letter | amounts.billed | miss | `345.55` | — |
| eval-013-coding-admin-letter | amounts.plan_paid | miss | `0` | — |
| eval-013-coding-admin-letter | amounts.patient_responsibility | miss | `345.55` | — |
| eval-013-coding-admin-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-013-coding-admin-letter | state_hint | miss | `"IL"` | — |
| eval-014-experimental-letter | document_type | miss | `"denial_letter"` | — |
| eval-014-experimental-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-014-experimental-letter | member_id | miss | `"TAM-829657-30"` | — |
| eval-014-experimental-letter | claim_number | miss | `"CLM-26-8150-96286"` | — |
| eval-014-experimental-letter | letter_date | miss | `"2026-09-24"` | — |
| eval-014-experimental-letter | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-014-experimental-letter | service_description | miss | `"Transcranial magnetic stimulation (TMS) treatment course"` | — |
| eval-014-experimental-letter | service_dates | miss | `["2026-08-18"]` | — |
| eval-014-experimental-letter | denial_category | miss | `"experimental"` | — |
| eval-014-experimental-letter | denial_codes | miss | `["CO-55"]` | — |
| eval-014-experimental-letter | amounts.billed | miss | `7203.26` | — |
| eval-014-experimental-letter | amounts.plan_paid | miss | `0` | — |
| eval-014-experimental-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-014-experimental-letter | state_hint | miss | `"OH"` | — |
| eval-015-timely-filing-eob | document_type | miss | `"eob"` | — |
| eval-015-timely-filing-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-015-timely-filing-eob | member_id | miss | `"HOL-094231-21"` | — |
| eval-015-timely-filing-eob | claim_number | miss | `"CLM-26-7309-53392"` | — |
| eval-015-timely-filing-eob | provider_name | miss | `"Clearwater Neurology Group"` | — |
| eval-015-timely-filing-eob | service_description | miss | `"MRI of the lumbar spine without contrast"` | — |
| eval-015-timely-filing-eob | service_dates | miss | `["2026-08-23"]` | — |
| eval-015-timely-filing-eob | denial_category | miss | `"timely_filing"` | — |
| eval-015-timely-filing-eob | denial_codes | miss | `["CO-29"]` | — |
| eval-015-timely-filing-eob | amounts.billed | miss | `1986.77` | — |
| eval-015-timely-filing-eob | amounts.allowed | miss | `0` | — |
| eval-015-timely-filing-eob | amounts.plan_paid | miss | `0` | — |
| eval-015-timely-filing-eob | amounts.patient_responsibility | miss | `1986.77` | — |
| eval-015-timely-filing-eob | network_status | miss | `"in_network"` | — |
| eval-015-timely-filing-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-015-timely-filing-eob | state_hint | miss | `"PA"` | — |
| eval-016-duplicate-letter | document_type | miss | `"denial_letter"` | — |
| eval-016-duplicate-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-016-duplicate-letter | member_id | miss | `"HOL-048146-16"` | — |
| eval-016-duplicate-letter | claim_number | miss | `"CLM-26-4616-05200"` | — |
| eval-016-duplicate-letter | letter_date | miss | `"2026-09-26"` | — |
| eval-016-duplicate-letter | provider_name | miss | `"Copperline Laboratory Services"` | — |
| eval-016-duplicate-letter | service_description | miss | `"CT scan of the chest with contrast"` | — |
| eval-016-duplicate-letter | service_dates | miss | `["2026-08-22"]` | — |
| eval-016-duplicate-letter | denial_category | miss | `"duplicate"` | — |
| eval-016-duplicate-letter | denial_codes | miss | `["CO-18"]` | — |
| eval-016-duplicate-letter | amounts.billed | miss | `2414.35` | — |
| eval-016-duplicate-letter | amounts.plan_paid | miss | `0` | — |
| eval-016-duplicate-letter | amounts.patient_responsibility | miss | `2414.35` | — |
| eval-016-duplicate-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-25"}` | — |
| eval-016-duplicate-letter | state_hint | miss | `"GA"` | — |
| eval-019-out-of-network-letter | document_type | miss | `"denial_letter"` | — |
| eval-019-out-of-network-letter | program_signals | miss | `"medicare"` | — |
| eval-019-out-of-network-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-019-out-of-network-letter | member_id | miss | `"HOL-353091-63"` | — |
| eval-019-out-of-network-letter | claim_number | miss | `"CLM-26-1246-35794"` | — |
| eval-019-out-of-network-letter | letter_date | miss | `"2026-07-18"` | — |
| eval-019-out-of-network-letter | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-019-out-of-network-letter | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-019-out-of-network-letter | service_dates | miss | `["2026-06-27"]` | — |
| eval-019-out-of-network-letter | denial_category | miss | `"out_of_network"` | — |
| eval-019-out-of-network-letter | denial_codes | miss | `["CO-242"]` | — |
| eval-019-out-of-network-letter | amounts.billed | miss | `2084.34` | — |
| eval-019-out-of-network-letter | amounts.plan_paid | miss | `0` | — |
| eval-019-out-of-network-letter | amounts.patient_responsibility | miss | `2084.34` | — |
| eval-019-out-of-network-letter | network_status | miss | `"out_of_network"` | — |
| eval-019-out-of-network-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-019-out-of-network-letter | state_hint | miss | `"TX"` | — |
| eval-020-medical-necessity-letter | document_type | miss | `"denial_letter"` | — |
| eval-020-medical-necessity-letter | insurer_name | miss | `"Larkspur Benefit Administrators"` | — |
| eval-020-medical-necessity-letter | member_id | miss | `"LAR-746436-58"` | — |
| eval-020-medical-necessity-letter | claim_number | miss | `"CLM-26-9796-38153"` | — |
| eval-020-medical-necessity-letter | letter_date | miss | `"2026-09-16"` | — |
| eval-020-medical-necessity-letter | provider_name | miss | `"Copperline Laboratory Services"` | — |
| eval-020-medical-necessity-letter | service_description | miss | `"Continued inpatient rehabilitation stay"` | — |
| eval-020-medical-necessity-letter | service_dates | miss | `["2026-08-30"]` | — |
| eval-020-medical-necessity-letter | denial_category | miss | `"medical_necessity"` | — |
| eval-020-medical-necessity-letter | denial_codes | miss | `["CO-50"]` | — |
| eval-020-medical-necessity-letter | amounts.billed | miss | `40791.8` | — |
| eval-020-medical-necessity-letter | amounts.plan_paid | miss | `0` | — |
| eval-020-medical-necessity-letter | amounts.patient_responsibility | miss | `40791.8` | — |
| eval-020-medical-necessity-letter | urgency_signals | miss | `true` | — |
| eval-020-medical-necessity-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-020-medical-necessity-letter | state_hint | miss | `"FL"` | — |
| eval-021-coding-admin-eob | document_type | miss | `"eob"` | — |
| eval-021-coding-admin-eob | insurer_name | miss | `"Verdane Health Plan"` | — |
| eval-021-coding-admin-eob | member_id | miss | `"VER-039597-76"` | — |
| eval-021-coding-admin-eob | claim_number | miss | `"CLM-26-2103-38020"` | — |
| eval-021-coding-admin-eob | letter_date | miss | `"2026-10-27"` | — |
| eval-021-coding-admin-eob | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-021-coding-admin-eob | service_description | miss | `"MRI of the lumbar spine without contrast"` | — |
| eval-021-coding-admin-eob | service_dates | miss | `["2026-10-03"]` | — |
| eval-021-coding-admin-eob | denial_category | miss | `"coding_admin"` | — |
| eval-021-coding-admin-eob | denial_codes | miss | `["CO-16"]` | — |
| eval-021-coding-admin-eob | amounts.billed | miss | `2282.15` | — |
| eval-021-coding-admin-eob | amounts.allowed | miss | `0` | — |
| eval-021-coding-admin-eob | amounts.plan_paid | miss | `0` | — |
| eval-021-coding-admin-eob | amounts.patient_responsibility | miss | `2282.15` | — |
| eval-021-coding-admin-eob | network_status | miss | `"in_network"` | — |
| eval-021-coding-admin-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-021-coding-admin-eob | state_hint | miss | `"IL"` | — |
| eval-022-experimental-letter | document_type | miss | `"denial_letter"` | — |
| eval-022-experimental-letter | program_signals | miss | `"medicaid"` | — |
| eval-022-experimental-letter | insurer_name | miss | `"Calloway Health Network"` | — |
| eval-022-experimental-letter | member_id | miss | `"CAL-356400-06"` | — |
| eval-022-experimental-letter | claim_number | miss | `"CLM-26-8037-16429"` | — |
| eval-022-experimental-letter | letter_date | miss | `"2026-10-20"` | — |
| eval-022-experimental-letter | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-022-experimental-letter | service_description | miss | `"Transcranial magnetic stimulation (TMS) treatment course"` | — |
| eval-022-experimental-letter | service_dates | miss | `["2026-09-18"]` | — |
| eval-022-experimental-letter | denial_category | miss | `"experimental"` | — |
| eval-022-experimental-letter | denial_codes | miss | `["CO-55"]` | — |
| eval-022-experimental-letter | amounts.billed | miss | `8687.8` | — |
| eval-022-experimental-letter | amounts.plan_paid | miss | `0` | — |
| eval-022-experimental-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-022-experimental-letter | state_hint | miss | `"OH"` | — |
| eval-023-out-of-network-letter | document_type | miss | `"denial_letter"` | — |
| eval-023-out-of-network-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-023-out-of-network-letter | member_id | miss | `"OST-328851-31"` | — |
| eval-023-out-of-network-letter | claim_number | miss | `"CLM-26-9822-60845"` | — |
| eval-023-out-of-network-letter | letter_date | miss | `"2026-10-08"` | — |
| eval-023-out-of-network-letter | provider_name | miss | `"Pinewood Emergency Associates"` | — |
| eval-023-out-of-network-letter | service_description | miss | `"Emergency department visit, level 4"` | — |
| eval-023-out-of-network-letter | service_dates | miss | `["2026-09-12"]` | — |
| eval-023-out-of-network-letter | denial_category | miss | `"out_of_network"` | — |
| eval-023-out-of-network-letter | denial_codes | miss | `["CO-242"]` | — |
| eval-023-out-of-network-letter | amounts.billed | miss | `1767.75` | — |
| eval-023-out-of-network-letter | amounts.plan_paid | miss | `0` | — |
| eval-023-out-of-network-letter | amounts.patient_responsibility | miss | `1767.75` | — |
| eval-023-out-of-network-letter | network_status | miss | `"out_of_network"` | — |
| eval-023-out-of-network-letter | emergency_signals | miss | `true` | — |
| eval-023-out-of-network-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-023-out-of-network-letter | state_hint | miss | `"PA"` | — |
| eval-024-duplicate-eob | document_type | miss | `"eob"` | — |
| eval-024-duplicate-eob | insurer_name | miss | `"Verdane Health Plan"` | — |
| eval-024-duplicate-eob | member_id | miss | `"VER-087933-75"` | — |
| eval-024-duplicate-eob | claim_number | miss | `"CLM-26-1782-80563"` | — |
| eval-024-duplicate-eob | letter_date | miss | `"2026-08-09"` | — |
| eval-024-duplicate-eob | provider_name | miss | `"Clearwater Neurology Group"` | — |
| eval-024-duplicate-eob | service_description | miss | `"Comprehensive metabolic panel and lipid panel"` | — |
| eval-024-duplicate-eob | service_dates | miss | `["2026-07-28"]` | — |
| eval-024-duplicate-eob | denial_category | miss | `"duplicate"` | — |
| eval-024-duplicate-eob | denial_codes | miss | `["CO-18"]` | — |
| eval-024-duplicate-eob | amounts.billed | miss | `230.69` | — |
| eval-024-duplicate-eob | amounts.allowed | miss | `0` | — |
| eval-024-duplicate-eob | amounts.plan_paid | miss | `0` | — |
| eval-024-duplicate-eob | amounts.patient_responsibility | miss | `230.69` | — |
| eval-024-duplicate-eob | network_status | miss | `"in_network"` | — |
| eval-024-duplicate-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-024-duplicate-eob | state_hint | miss | `"GA"` | — |
| eval-027-out-of-network-eob | document_type | miss | `"eob"` | — |
| eval-027-out-of-network-eob | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-027-out-of-network-eob | member_id | miss | `"TAM-928681-21"` | — |
| eval-027-out-of-network-eob | claim_number | miss | `"CLM-26-2047-57553"` | — |
| eval-027-out-of-network-eob | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-027-out-of-network-eob | service_description | miss | `"Occupational therapy evaluation"` | — |
| eval-027-out-of-network-eob | service_dates | miss | `["2026-09-13"]` | — |
| eval-027-out-of-network-eob | denial_category | miss | `"out_of_network"` | — |
| eval-027-out-of-network-eob | denial_codes | miss | `["CO-242"]` | — |
| eval-027-out-of-network-eob | amounts.billed | miss | `478.6` | — |
| eval-027-out-of-network-eob | amounts.allowed | miss | `194.73` | — |
| eval-027-out-of-network-eob | amounts.plan_paid | miss | `155.78` | — |
| eval-027-out-of-network-eob | amounts.patient_responsibility | miss | `322.82` | — |
| eval-027-out-of-network-eob | network_status | miss | `"out_of_network"` | — |
| eval-027-out-of-network-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-027-out-of-network-eob | state_hint | miss | `"TX"` | — |
| eval-028-not-covered-letter | document_type | miss | `"denial_letter"` | — |
| eval-028-not-covered-letter | insurer_name | miss | `"Calloway Health Network"` | — |
| eval-028-not-covered-letter | member_id | miss | `"CAL-193190-90"` | — |
| eval-028-not-covered-letter | claim_number | miss | `"CLM-26-5425-93140"` | — |
| eval-028-not-covered-letter | letter_date | miss | `"2026-07-03"` | — |
| eval-028-not-covered-letter | provider_name | miss | `"Meadowbrook Physical Therapy"` | — |
| eval-028-not-covered-letter | service_description | miss | `"Upper GI endoscopy with biopsy"` | — |
| eval-028-not-covered-letter | service_dates | miss | `["2026-06-10"]` | — |
| eval-028-not-covered-letter | denial_category | miss | `"not_covered"` | — |
| eval-028-not-covered-letter | denial_codes | miss | `["CO-96"]` | — |
| eval-028-not-covered-letter | amounts.billed | miss | `2525.33` | — |
| eval-028-not-covered-letter | amounts.plan_paid | miss | `0` | — |
| eval-028-not-covered-letter | amounts.patient_responsibility | miss | `2525.33` | — |
| eval-028-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2026-12-30"}` | — |
| eval-028-not-covered-letter | state_hint | miss | `"FL"` | — |
| eval-029-coding-admin-letter | document_type | miss | `"denial_letter"` | — |
| eval-029-coding-admin-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-029-coding-admin-letter | member_id | miss | `"OST-355011-30"` | — |
| eval-029-coding-admin-letter | claim_number | miss | `"CLM-26-3029-32881"` | — |
| eval-029-coding-admin-letter | letter_date | miss | `"2026-08-19"` | — |
| eval-029-coding-admin-letter | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-029-coding-admin-letter | service_description | miss | `"Comprehensive metabolic panel and lipid panel"` | — |
| eval-029-coding-admin-letter | service_dates | miss | `["2026-07-15"]` | — |
| eval-029-coding-admin-letter | denial_category | miss | `"coding_admin"` | — |
| eval-029-coding-admin-letter | denial_codes | miss | `["CO-16"]` | — |
| eval-029-coding-admin-letter | amounts.billed | miss | `402.54` | — |
| eval-029-coding-admin-letter | amounts.plan_paid | miss | `0` | — |
| eval-029-coding-admin-letter | amounts.patient_responsibility | miss | `402.54` | — |
| eval-029-coding-admin-letter | stated_appeal_deadline | miss | `{"kind":"days","days":60}` | — |
| eval-029-coding-admin-letter | state_hint | miss | `"IL"` | — |
| eval-030-experimental-eob | document_type | miss | `"eob"` | — |
| eval-030-experimental-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-030-experimental-eob | member_id | miss | `"HOL-798420-54"` | — |
| eval-030-experimental-eob | claim_number | miss | `"CLM-26-3837-45815"` | — |
| eval-030-experimental-eob | letter_date | miss | `"2026-08-07"` | — |
| eval-030-experimental-eob | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-030-experimental-eob | service_description | miss | `"Genetic expression profiling test for breast cancer"` | — |
| eval-030-experimental-eob | service_dates | miss | `["2026-07-06"]` | — |
| eval-030-experimental-eob | denial_category | miss | `"experimental"` | — |
| eval-030-experimental-eob | denial_codes | miss | `["CO-55"]` | — |
| eval-030-experimental-eob | amounts.billed | miss | `4003.67` | — |
| eval-030-experimental-eob | amounts.allowed | miss | `0` | — |
| eval-030-experimental-eob | amounts.plan_paid | miss | `0` | — |
| eval-030-experimental-eob | amounts.patient_responsibility | miss | `4003.67` | — |
| eval-030-experimental-eob | network_status | miss | `"in_network"` | — |
| eval-030-experimental-eob | state_hint | miss | `"OH"` | — |
| eval-031-timely-filing-letter | document_type | miss | `"denial_letter"` | — |
| eval-031-timely-filing-letter | program_signals | miss | `"medicare"` | — |
| eval-031-timely-filing-letter | insurer_name | miss | `"Brightmoor Benefit Solutions"` | — |
| eval-031-timely-filing-letter | member_id | miss | `"BRI-500182-40"` | — |
| eval-031-timely-filing-letter | claim_number | miss | `"CLM-26-6180-04638"` | — |
| eval-031-timely-filing-letter | letter_date | miss | `"2026-10-23"` | — |
| eval-031-timely-filing-letter | provider_name | miss | `"Clearwater Neurology Group"` | — |
| eval-031-timely-filing-letter | service_description | miss | `"Occupational therapy evaluation"` | — |
| eval-031-timely-filing-letter | service_dates | miss | `["2026-09-18"]` | — |
| eval-031-timely-filing-letter | denial_category | miss | `"timely_filing"` | — |
| eval-031-timely-filing-letter | denial_codes | miss | `["CO-29"]` | — |
| eval-031-timely-filing-letter | amounts.billed | miss | `311.57` | — |
| eval-031-timely-filing-letter | amounts.plan_paid | miss | `0` | — |
| eval-031-timely-filing-letter | amounts.patient_responsibility | miss | `311.57` | — |
| eval-031-timely-filing-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-031-timely-filing-letter | state_hint | miss | `"PA"` | — |
| eval-032-medical-necessity-letter | document_type | miss | `"denial_letter"` | — |
| eval-032-medical-necessity-letter | insurer_name | miss | `"Tamsin Health Partners"` | — |
| eval-032-medical-necessity-letter | member_id | miss | `"TAM-051972-95"` | — |
| eval-032-medical-necessity-letter | claim_number | miss | `"CLM-26-6056-79980"` | — |
| eval-032-medical-necessity-letter | letter_date | miss | `"2026-10-12"` | — |
| eval-032-medical-necessity-letter | provider_name | miss | `"Meadowbrook Physical Therapy"` | — |
| eval-032-medical-necessity-letter | service_description | miss | `"Continued inpatient rehabilitation stay"` | — |
| eval-032-medical-necessity-letter | service_dates | miss | `["2026-09-21"]` | — |
| eval-032-medical-necessity-letter | denial_category | miss | `"medical_necessity"` | — |
| eval-032-medical-necessity-letter | denial_codes | miss | `["CO-50"]` | — |
| eval-032-medical-necessity-letter | amounts.billed | miss | `21280.2` | — |
| eval-032-medical-necessity-letter | amounts.plan_paid | miss | `0` | — |
| eval-032-medical-necessity-letter | amounts.patient_responsibility | miss | `21280.2` | — |
| eval-032-medical-necessity-letter | urgency_signals | miss | `true` | — |
| eval-032-medical-necessity-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-032-medical-necessity-letter | state_hint | miss | `"GA"` | — |
| eval-033-medical-necessity-eob | state_hint | wrong | `"CA"` | `"GA"` |
| eval-034-prior-auth-letter | document_type | miss | `"denial_letter"` | — |
| eval-034-prior-auth-letter | program_signals | miss | `"medicaid"` | — |
| eval-034-prior-auth-letter | insurer_name | miss | `"Quillfield Health Plan"` | — |
| eval-034-prior-auth-letter | member_id | miss | `"QUI-834725-85"` | — |
| eval-034-prior-auth-letter | claim_number | miss | `"CLM-26-3572-87774"` | — |
| eval-034-prior-auth-letter | letter_date | miss | `"2026-08-12"` | — |
| eval-034-prior-auth-letter | provider_name | miss | `"Copperline Laboratory Services"` | — |
| eval-034-prior-auth-letter | service_description | miss | `"MRI of the lumbar spine without contrast"` | — |
| eval-034-prior-auth-letter | service_dates | miss | `["2026-07-09"]` | — |
| eval-034-prior-auth-letter | denial_category | miss | `"prior_auth"` | — |
| eval-034-prior-auth-letter | denial_codes | miss | `["CO-197"]` | — |
| eval-034-prior-auth-letter | amounts.billed | miss | `3172.38` | — |
| eval-034-prior-auth-letter | amounts.plan_paid | miss | `0` | — |
| eval-034-prior-auth-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-034-prior-auth-letter | state_hint | miss | `"NY"` | — |
| eval-035-out-of-network-letter | document_type | miss | `"denial_letter"` | — |
| eval-035-out-of-network-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-035-out-of-network-letter | member_id | miss | `"HOL-229415-82"` | — |
| eval-035-out-of-network-letter | claim_number | miss | `"CLM-26-1594-68530"` | — |
| eval-035-out-of-network-letter | letter_date | miss | `"2026-08-19"` | — |
| eval-035-out-of-network-letter | provider_name | miss | `"Pinewood Emergency Associates"` | — |
| eval-035-out-of-network-letter | service_description | miss | `"Emergency department visit, level 5"` | — |
| eval-035-out-of-network-letter | service_dates | miss | `["2026-07-08"]` | — |
| eval-035-out-of-network-letter | denial_category | miss | `"out_of_network"` | — |
| eval-035-out-of-network-letter | denial_codes | miss | `["CO-242"]` | — |
| eval-035-out-of-network-letter | amounts.billed | miss | `2276.67` | — |
| eval-035-out-of-network-letter | amounts.plan_paid | miss | `0` | — |
| eval-035-out-of-network-letter | amounts.patient_responsibility | miss | `2276.67` | — |
| eval-035-out-of-network-letter | network_status | miss | `"out_of_network"` | — |
| eval-035-out-of-network-letter | emergency_signals | miss | `true` | — |
| eval-035-out-of-network-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-035-out-of-network-letter | state_hint | miss | `"TX"` | — |
| eval-036-not-covered-eob | document_type | miss | `"eob"` | — |
| eval-036-not-covered-eob | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-036-not-covered-eob | member_id | miss | `"OST-625455-32"` | — |
| eval-036-not-covered-eob | claim_number | miss | `"CLM-26-9301-78855"` | — |
| eval-036-not-covered-eob | letter_date | miss | `"2026-09-04"` | — |
| eval-036-not-covered-eob | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-036-not-covered-eob | service_description | miss | `"Polysomnography sleep study"` | — |
| eval-036-not-covered-eob | service_dates | miss | `["2026-07-30"]` | — |
| eval-036-not-covered-eob | denial_category | miss | `"not_covered"` | — |
| eval-036-not-covered-eob | denial_codes | miss | `["CO-96"]` | — |
| eval-036-not-covered-eob | amounts.billed | miss | `3037.41` | — |
| eval-036-not-covered-eob | amounts.allowed | miss | `0` | — |
| eval-036-not-covered-eob | amounts.plan_paid | miss | `0` | — |
| eval-036-not-covered-eob | amounts.patient_responsibility | miss | `3037.41` | — |
| eval-036-not-covered-eob | network_status | miss | `"in_network"` | — |
| eval-036-not-covered-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-036-not-covered-eob | state_hint | miss | `"FL"` | — |
| eval-037-coding-admin-letter | document_type | miss | `"denial_letter"` | — |
| eval-037-coding-admin-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-037-coding-admin-letter | member_id | miss | `"HOL-584211-65"` | — |
| eval-037-coding-admin-letter | claim_number | miss | `"CLM-26-9085-46790"` | — |
| eval-037-coding-admin-letter | letter_date | miss | `"2026-07-25"` | — |
| eval-037-coding-admin-letter | provider_name | miss | `"Meadowbrook Physical Therapy"` | — |
| eval-037-coding-admin-letter | service_description | miss | `"MRI of the lumbar spine without contrast"` | — |
| eval-037-coding-admin-letter | service_dates | miss | `["2026-06-21"]` | — |
| eval-037-coding-admin-letter | denial_category | miss | `"coding_admin"` | — |
| eval-037-coding-admin-letter | denial_codes | miss | `["CO-16"]` | — |
| eval-037-coding-admin-letter | amounts.billed | miss | `2831.14` | — |
| eval-037-coding-admin-letter | amounts.plan_paid | miss | `0` | — |
| eval-037-coding-admin-letter | amounts.patient_responsibility | miss | `2831.14` | — |
| eval-037-coding-admin-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-037-coding-admin-letter | state_hint | miss | `"IL"` | — |
| eval-038-experimental-letter | document_type | miss | `"denial_letter"` | — |
| eval-038-experimental-letter | insurer_name | miss | `"Verdane Health Plan"` | — |
| eval-038-experimental-letter | member_id | miss | `"VER-247025-88"` | — |
| eval-038-experimental-letter | claim_number | miss | `"CLM-26-9643-37553"` | — |
| eval-038-experimental-letter | letter_date | miss | `"2026-07-09"` | — |
| eval-038-experimental-letter | provider_name | miss | `"Clearwater Neurology Group"` | — |
| eval-038-experimental-letter | service_description | miss | `"Transcranial magnetic stimulation (TMS) treatment course"` | — |
| eval-038-experimental-letter | service_dates | miss | `["2026-06-17"]` | — |
| eval-038-experimental-letter | denial_category | miss | `"experimental"` | — |
| eval-038-experimental-letter | denial_codes | miss | `["CO-55"]` | — |
| eval-038-experimental-letter | amounts.billed | miss | `6807.11` | — |
| eval-038-experimental-letter | amounts.plan_paid | miss | `0` | — |
| eval-038-experimental-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-038-experimental-letter | state_hint | miss | `"OH"` | — |
| eval-039-timely-filing-eob | document_type | miss | `"eob"` | — |
| eval-039-timely-filing-eob | insurer_name | miss | `"Verdane Health Plan"` | — |
| eval-039-timely-filing-eob | member_id | miss | `"VER-663293-26"` | — |
| eval-039-timely-filing-eob | claim_number | miss | `"CLM-26-7968-91838"` | — |
| eval-039-timely-filing-eob | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-039-timely-filing-eob | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-039-timely-filing-eob | service_dates | miss | `["2026-08-07"]` | — |
| eval-039-timely-filing-eob | denial_category | miss | `"timely_filing"` | — |
| eval-039-timely-filing-eob | denial_codes | miss | `["CO-29"]` | — |
| eval-039-timely-filing-eob | amounts.billed | miss | `1623.39` | — |
| eval-039-timely-filing-eob | amounts.allowed | miss | `0` | — |
| eval-039-timely-filing-eob | amounts.plan_paid | miss | `0` | — |
| eval-039-timely-filing-eob | amounts.patient_responsibility | miss | `1623.39` | — |
| eval-039-timely-filing-eob | network_status | miss | `"in_network"` | — |
| eval-039-timely-filing-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-039-timely-filing-eob | state_hint | miss | `"PA"` | — |
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
| eval-043-out-of-network-letter | document_type | miss | `"denial_letter"` | — |
| eval-043-out-of-network-letter | program_signals | miss | `"medicare"` | — |
| eval-043-out-of-network-letter | insurer_name | miss | `"Larkspur Benefit Administrators"` | — |
| eval-043-out-of-network-letter | member_id | miss | `"LAR-225914-97"` | — |
| eval-043-out-of-network-letter | claim_number | miss | `"CLM-26-7802-12561"` | — |
| eval-043-out-of-network-letter | letter_date | miss | `"2026-10-10"` | — |
| eval-043-out-of-network-letter | provider_name | miss | `"Lantern Hill Cardiology"` | — |
| eval-043-out-of-network-letter | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-043-out-of-network-letter | service_dates | miss | `["2026-08-26"]` | — |
| eval-043-out-of-network-letter | denial_category | miss | `"out_of_network"` | — |
| eval-043-out-of-network-letter | denial_codes | miss | `["CO-242"]` | — |
| eval-043-out-of-network-letter | amounts.billed | miss | `1394.35` | — |
| eval-043-out-of-network-letter | amounts.plan_paid | miss | `0` | — |
| eval-043-out-of-network-letter | amounts.patient_responsibility | miss | `1394.35` | — |
| eval-043-out-of-network-letter | network_status | miss | `"out_of_network"` | — |
| eval-043-out-of-network-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-043-out-of-network-letter | state_hint | miss | `"TX"` | — |
| eval-044-medical-necessity-letter | document_type | miss | `"denial_letter"` | — |
| eval-044-medical-necessity-letter | insurer_name | miss | `"Larkspur Benefit Administrators"` | — |
| eval-044-medical-necessity-letter | member_id | miss | `"LAR-199105-99"` | — |
| eval-044-medical-necessity-letter | claim_number | miss | `"CLM-26-2408-67468"` | — |
| eval-044-medical-necessity-letter | letter_date | miss | `"2026-09-07"` | — |
| eval-044-medical-necessity-letter | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-044-medical-necessity-letter | service_description | miss | `"Continued inpatient rehabilitation stay"` | — |
| eval-044-medical-necessity-letter | service_dates | miss | `["2026-08-24"]` | — |
| eval-044-medical-necessity-letter | denial_category | miss | `"medical_necessity"` | — |
| eval-044-medical-necessity-letter | denial_codes | miss | `["CO-50"]` | — |
| eval-044-medical-necessity-letter | amounts.billed | miss | `22291.23` | — |
| eval-044-medical-necessity-letter | amounts.plan_paid | miss | `0` | — |
| eval-044-medical-necessity-letter | amounts.patient_responsibility | miss | `22291.23` | — |
| eval-044-medical-necessity-letter | urgency_signals | miss | `true` | — |
| eval-044-medical-necessity-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-044-medical-necessity-letter | state_hint | miss | `"FL"` | — |
| eval-045-coding-admin-eob | document_type | miss | `"eob"` | — |
| eval-045-coding-admin-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-045-coding-admin-eob | member_id | miss | `"HOL-536489-85"` | — |
| eval-045-coding-admin-eob | claim_number | miss | `"CLM-26-1956-76880"` | — |
| eval-045-coding-admin-eob | letter_date | miss | `"2026-09-15"` | — |
| eval-045-coding-admin-eob | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-045-coding-admin-eob | service_description | miss | `"Vitamin D, 25-hydroxy level"` | — |
| eval-045-coding-admin-eob | service_dates | miss | `["2026-08-28"]` | — |
| eval-045-coding-admin-eob | denial_category | miss | `"coding_admin"` | — |
| eval-045-coding-admin-eob | denial_codes | miss | `["CO-16"]` | — |
| eval-045-coding-admin-eob | amounts.billed | miss | `224.63` | — |
| eval-045-coding-admin-eob | amounts.allowed | miss | `0` | — |
| eval-045-coding-admin-eob | amounts.plan_paid | miss | `0` | — |
| eval-045-coding-admin-eob | amounts.patient_responsibility | miss | `224.63` | — |
| eval-045-coding-admin-eob | network_status | miss | `"in_network"` | — |
| eval-045-coding-admin-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-045-coding-admin-eob | state_hint | miss | `"IL"` | — |
| eval-046-experimental-letter | document_type | miss | `"denial_letter"` | — |
| eval-046-experimental-letter | program_signals | miss | `"medicaid"` | — |
| eval-046-experimental-letter | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-046-experimental-letter | member_id | miss | `"HOL-548914-35"` | — |
| eval-046-experimental-letter | claim_number | miss | `"CLM-26-9066-56034"` | — |
| eval-046-experimental-letter | letter_date | miss | `"2026-09-11"` | — |
| eval-046-experimental-letter | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-046-experimental-letter | service_description | miss | `"Genetic expression profiling test for breast cancer"` | — |
| eval-046-experimental-letter | service_dates | miss | `["2026-08-17"]` | — |
| eval-046-experimental-letter | denial_category | miss | `"experimental"` | — |
| eval-046-experimental-letter | denial_codes | miss | `["CO-55"]` | — |
| eval-046-experimental-letter | amounts.billed | miss | `4486.99` | — |
| eval-046-experimental-letter | amounts.plan_paid | miss | `0` | — |
| eval-046-experimental-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-046-experimental-letter | state_hint | miss | `"OH"` | — |
| eval-048-duplicate-eob | document_type | miss | `"eob"` | — |
| eval-048-duplicate-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-048-duplicate-eob | member_id | miss | `"HOL-996791-79"` | — |
| eval-048-duplicate-eob | claim_number | miss | `"CLM-26-7520-81922"` | — |
| eval-048-duplicate-eob | letter_date | miss | `"2026-08-26"` | — |
| eval-048-duplicate-eob | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-048-duplicate-eob | service_description | miss | `"Comprehensive metabolic panel and lipid panel"` | — |
| eval-048-duplicate-eob | service_dates | miss | `["2026-07-17"]` | — |
| eval-048-duplicate-eob | denial_category | miss | `"duplicate"` | — |
| eval-048-duplicate-eob | denial_codes | miss | `["CO-18"]` | — |
| eval-048-duplicate-eob | amounts.billed | miss | `356.86` | — |
| eval-048-duplicate-eob | amounts.allowed | miss | `0` | — |
| eval-048-duplicate-eob | amounts.plan_paid | miss | `0` | — |
| eval-048-duplicate-eob | amounts.patient_responsibility | miss | `356.86` | — |
| eval-048-duplicate-eob | network_status | miss | `"in_network"` | — |
| eval-048-duplicate-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-048-duplicate-eob | state_hint | miss | `"GA"` | — |
| eval-050-prior-auth-letter | amounts.patient_responsibility | hallucination | — | `0` |
| eval-051-out-of-network-eob | document_type | miss | `"eob"` | — |
| eval-051-out-of-network-eob | insurer_name | miss | `"Verdane Health Plan"` | — |
| eval-051-out-of-network-eob | member_id | miss | `"VER-300025-66"` | — |
| eval-051-out-of-network-eob | claim_number | miss | `"CLM-26-4272-69448"` | — |
| eval-051-out-of-network-eob | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-051-out-of-network-eob | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-051-out-of-network-eob | service_dates | miss | `["2026-09-27"]` | — |
| eval-051-out-of-network-eob | denial_category | miss | `"out_of_network"` | — |
| eval-051-out-of-network-eob | denial_codes | miss | `["CO-242"]` | — |
| eval-051-out-of-network-eob | amounts.billed | miss | `1790.89` | — |
| eval-051-out-of-network-eob | amounts.allowed | miss | `582.33` | — |
| eval-051-out-of-network-eob | amounts.plan_paid | miss | `465.86` | — |
| eval-051-out-of-network-eob | amounts.patient_responsibility | miss | `1325.03` | — |
| eval-051-out-of-network-eob | network_status | miss | `"out_of_network"` | — |
| eval-051-out-of-network-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-051-out-of-network-eob | state_hint | miss | `"TX"` | — |
| eval-052-not-covered-letter | document_type | miss | `"denial_letter"` | — |
| eval-052-not-covered-letter | insurer_name | miss | `"Brightmoor Benefit Solutions"` | — |
| eval-052-not-covered-letter | member_id | miss | `"BRI-953253-38"` | — |
| eval-052-not-covered-letter | claim_number | miss | `"CLM-26-1590-72283"` | — |
| eval-052-not-covered-letter | letter_date | miss | `"2026-09-08"` | — |
| eval-052-not-covered-letter | provider_name | miss | `"Riverside Orthopedic Associates"` | — |
| eval-052-not-covered-letter | service_description | miss | `"Arthroscopic knee meniscectomy"` | — |
| eval-052-not-covered-letter | service_dates | miss | `["2026-08-20"]` | — |
| eval-052-not-covered-letter | denial_category | miss | `"not_covered"` | — |
| eval-052-not-covered-letter | denial_codes | miss | `["CO-96"]` | — |
| eval-052-not-covered-letter | amounts.billed | miss | `14364.79` | — |
| eval-052-not-covered-letter | amounts.plan_paid | miss | `0` | — |
| eval-052-not-covered-letter | amounts.patient_responsibility | miss | `14364.79` | — |
| eval-052-not-covered-letter | stated_appeal_deadline | miss | `{"kind":"date","date":"2027-03-07"}` | — |
| eval-052-not-covered-letter | state_hint | miss | `"FL"` | — |
| eval-053-coding-admin-letter | document_type | miss | `"denial_letter"` | — |
| eval-053-coding-admin-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-053-coding-admin-letter | member_id | miss | `"OST-326275-86"` | — |
| eval-053-coding-admin-letter | claim_number | miss | `"CLM-26-2516-38728"` | — |
| eval-053-coding-admin-letter | letter_date | miss | `"2026-10-10"` | — |
| eval-053-coding-admin-letter | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-053-coding-admin-letter | service_description | miss | `"MRI of the left knee without contrast"` | — |
| eval-053-coding-admin-letter | service_dates | miss | `["2026-09-27"]` | — |
| eval-053-coding-admin-letter | denial_category | miss | `"coding_admin"` | — |
| eval-053-coding-admin-letter | denial_codes | miss | `["CO-16"]` | — |
| eval-053-coding-admin-letter | amounts.billed | miss | `2272.57` | — |
| eval-053-coding-admin-letter | amounts.plan_paid | miss | `0` | — |
| eval-053-coding-admin-letter | amounts.patient_responsibility | miss | `2272.57` | — |
| eval-053-coding-admin-letter | stated_appeal_deadline | miss | `{"kind":"days","days":60}` | — |
| eval-053-coding-admin-letter | state_hint | miss | `"IL"` | — |
| eval-054-experimental-eob | document_type | miss | `"eob"` | — |
| eval-054-experimental-eob | insurer_name | miss | `"Brightmoor Benefit Solutions"` | — |
| eval-054-experimental-eob | member_id | miss | `"BRI-556055-97"` | — |
| eval-054-experimental-eob | claim_number | miss | `"CLM-26-8965-70935"` | — |
| eval-054-experimental-eob | letter_date | miss | `"2026-10-08"` | — |
| eval-054-experimental-eob | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-054-experimental-eob | service_description | miss | `"Genetic expression profiling test for breast cancer"` | — |
| eval-054-experimental-eob | service_dates | miss | `["2026-09-11"]` | — |
| eval-054-experimental-eob | denial_category | miss | `"experimental"` | — |
| eval-054-experimental-eob | denial_codes | miss | `["CO-55"]` | — |
| eval-054-experimental-eob | amounts.billed | miss | `3999.58` | — |
| eval-054-experimental-eob | amounts.allowed | miss | `0` | — |
| eval-054-experimental-eob | amounts.plan_paid | miss | `0` | — |
| eval-054-experimental-eob | amounts.patient_responsibility | miss | `3999.58` | — |
| eval-054-experimental-eob | network_status | miss | `"in_network"` | — |
| eval-054-experimental-eob | state_hint | miss | `"OH"` | — |
| eval-055-timely-filing-letter | document_type | miss | `"denial_letter"` | — |
| eval-055-timely-filing-letter | program_signals | miss | `"medicare"` | — |
| eval-055-timely-filing-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-055-timely-filing-letter | member_id | miss | `"OST-044944-57"` | — |
| eval-055-timely-filing-letter | claim_number | miss | `"CLM-26-5165-65229"` | — |
| eval-055-timely-filing-letter | letter_date | miss | `"2026-08-20"` | — |
| eval-055-timely-filing-letter | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-055-timely-filing-letter | service_description | miss | `"Physical therapy, therapeutic exercise (12 sessions)"` | — |
| eval-055-timely-filing-letter | service_dates | miss | `["2026-07-10"]` | — |
| eval-055-timely-filing-letter | denial_category | miss | `"timely_filing"` | — |
| eval-055-timely-filing-letter | denial_codes | miss | `["CO-29"]` | — |
| eval-055-timely-filing-letter | amounts.billed | miss | `1995.33` | — |
| eval-055-timely-filing-letter | amounts.plan_paid | miss | `0` | — |
| eval-055-timely-filing-letter | amounts.patient_responsibility | miss | `1995.33` | — |
| eval-055-timely-filing-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-055-timely-filing-letter | state_hint | miss | `"PA"` | — |
| eval-057-medical-necessity-eob | document_type | miss | `"eob"` | — |
| eval-057-medical-necessity-eob | insurer_name | miss | `"Hollis Creek Health"` | — |
| eval-057-medical-necessity-eob | member_id | miss | `"HOL-033912-44"` | — |
| eval-057-medical-necessity-eob | claim_number | miss | `"CLM-26-3372-62774"` | — |
| eval-057-medical-necessity-eob | letter_date | miss | `"2026-10-14"` | — |
| eval-057-medical-necessity-eob | provider_name | miss | `"Westfield Sleep Clinic"` | — |
| eval-057-medical-necessity-eob | service_description | miss | `"Arthroscopic knee meniscectomy"` | — |
| eval-057-medical-necessity-eob | service_dates | miss | `["2026-09-06"]` | — |
| eval-057-medical-necessity-eob | denial_category | miss | `"medical_necessity"` | — |
| eval-057-medical-necessity-eob | denial_codes | miss | `["CO-50"]` | — |
| eval-057-medical-necessity-eob | amounts.billed | miss | `13789.85` | — |
| eval-057-medical-necessity-eob | amounts.allowed | miss | `0` | — |
| eval-057-medical-necessity-eob | amounts.plan_paid | miss | `0` | — |
| eval-057-medical-necessity-eob | amounts.patient_responsibility | miss | `13789.85` | — |
| eval-057-medical-necessity-eob | network_status | miss | `"in_network"` | — |
| eval-057-medical-necessity-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-057-medical-necessity-eob | state_hint | miss | `"CA"` | — |
| eval-059-out-of-network-letter | document_type | miss | `"denial_letter"` | — |
| eval-059-out-of-network-letter | insurer_name | miss | `"Ostrander Mutual Health"` | — |
| eval-059-out-of-network-letter | member_id | miss | `"OST-613058-30"` | — |
| eval-059-out-of-network-letter | claim_number | miss | `"CLM-26-2685-72902"` | — |
| eval-059-out-of-network-letter | letter_date | miss | `"2026-09-01"` | — |
| eval-059-out-of-network-letter | provider_name | miss | `"Pinewood Emergency Associates"` | — |
| eval-059-out-of-network-letter | service_description | miss | `"Emergency department visit, level 4"` | — |
| eval-059-out-of-network-letter | service_dates | miss | `["2026-08-15"]` | — |
| eval-059-out-of-network-letter | denial_category | miss | `"out_of_network"` | — |
| eval-059-out-of-network-letter | denial_codes | miss | `["CO-242"]` | — |
| eval-059-out-of-network-letter | amounts.billed | miss | `1450.28` | — |
| eval-059-out-of-network-letter | amounts.plan_paid | miss | `0` | — |
| eval-059-out-of-network-letter | amounts.patient_responsibility | miss | `1450.28` | — |
| eval-059-out-of-network-letter | network_status | miss | `"out_of_network"` | — |
| eval-059-out-of-network-letter | emergency_signals | miss | `true` | — |
| eval-059-out-of-network-letter | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-059-out-of-network-letter | state_hint | miss | `"TX"` | — |
| eval-060-not-covered-eob | document_type | miss | `"eob"` | — |
| eval-060-not-covered-eob | insurer_name | miss | `"Quillfield Health Plan"` | — |
| eval-060-not-covered-eob | member_id | miss | `"QUI-313401-75"` | — |
| eval-060-not-covered-eob | claim_number | miss | `"CLM-26-3928-06879"` | — |
| eval-060-not-covered-eob | letter_date | miss | `"2026-07-18"` | — |
| eval-060-not-covered-eob | provider_name | miss | `"Northgate Imaging Center"` | — |
| eval-060-not-covered-eob | service_description | miss | `"Vitamin D, 25-hydroxy level"` | — |
| eval-060-not-covered-eob | service_dates | miss | `["2026-06-10"]` | — |
| eval-060-not-covered-eob | denial_category | miss | `"not_covered"` | — |
| eval-060-not-covered-eob | denial_codes | miss | `["CO-96"]` | — |
| eval-060-not-covered-eob | amounts.billed | miss | `234.76` | — |
| eval-060-not-covered-eob | amounts.allowed | miss | `0` | — |
| eval-060-not-covered-eob | amounts.plan_paid | miss | `0` | — |
| eval-060-not-covered-eob | amounts.patient_responsibility | miss | `234.76` | — |
| eval-060-not-covered-eob | network_status | miss | `"in_network"` | — |
| eval-060-not-covered-eob | stated_appeal_deadline | miss | `{"kind":"days","days":180}` | — |
| eval-060-not-covered-eob | state_hint | miss | `"FL"` | — |


### Hand-written samples, against Claude's reading

| Sample | Fields that agree |
|---|---|
| 01-medical-necessity-ny | 19/19 |
| 02-prior-auth-ca | 4/19 · document_type (miss), program_signals (miss), insurer_name (miss), member_id (miss), claim_number (miss), letter_date (miss), provider_name (miss), service_dates (miss), denial_category (miss), denial_codes (miss), amounts.billed (miss), amounts.plan_paid (miss), network_status (miss), stated_appeal_deadline (miss), state_hint (miss) |
| 03-oon-emergency-tx-eob | 1/19 · document_type (miss), program_signals (miss), insurer_name (miss), member_id (miss), claim_number (miss), letter_date (miss), provider_name (miss), service_dates (miss), denial_category (miss), denial_codes (miss), amounts.billed (miss), amounts.allowed (miss), amounts.plan_paid (miss), amounts.patient_responsibility (miss), network_status (miss), emergency_signals (miss), stated_appeal_deadline (miss), state_hint (miss) |
| 04-not-covered-fl | 5/19 · document_type (miss), program_signals (miss), insurer_name (miss), member_id (miss), claim_number (miss), letter_date (miss), provider_name (miss), service_dates (miss), denial_category (miss), denial_codes (miss), amounts.billed (miss), amounts.plan_paid (miss), stated_appeal_deadline (miss), state_hint (miss) |
| 05-coding-error-ny-eob | 2/19 · document_type (miss), program_signals (miss), insurer_name (miss), member_id (miss), claim_number (miss), letter_date (miss), provider_name (miss), service_dates (miss), denial_category (miss), denial_codes (miss), amounts.billed (miss), amounts.allowed (miss), amounts.plan_paid (miss), amounts.patient_responsibility (miss), network_status (miss), stated_appeal_deadline (miss), state_hint (miss) |
| 06-medicare-unsupported | program read as **nothing** (Overturn stops on Medicare) |
| 07-experimental-ca-photo | 7/19 · document_type (miss), program_signals (miss), insurer_name (miss), member_id (miss), claim_number (miss), letter_date (miss), provider_name (miss), service_dates (miss), denial_category (miss), denial_codes (miss), stated_appeal_deadline (miss), state_hint (miss) |

