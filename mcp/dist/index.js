// src/index.ts
import { serve } from "@hono/node-server";

// src/server.ts
import { Hono } from "hono";

// ../data/rules/federal.json
var federal_default = [
  {
    id: "fed.internal_appeal.filing_window",
    jurisdiction: "federal",
    category: "deadline",
    title: "You have at least 180 days to file an internal appeal",
    summary: "Federal rules require your plan to give you at least 180 days after you receive the denial to ask the plan to reconsider (an internal appeal). Plans can give more time, never less.",
    legal_ref: "29 CFR 2560.503-1(h)(3)(i); 45 CFR 147.136(b)(2)(i), (b)(3)(i)",
    source_url: "https://www.law.cornell.edu/cfr/text/29/2560.503-1",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    deadline: {
      anchor: "letter_date",
      amount: 180,
      unit: "days",
      who: "consumer"
    },
    priority: 10,
    why_template: "This is the federal minimum for every job-based, Marketplace, and individual plan, counted from the date you received the denial."
  },
  {
    id: "fed.internal_appeal.decision_windows",
    jurisdiction: "federal",
    category: "process",
    title: "The plan must decide your appeal within set time limits",
    summary: "Once you appeal, the plan must answer: within 72 hours if the care is urgent; within 30 days for care you have not received yet (pre-service); within 60 days for care you already received (post-service). Plans with two appeal levels get 15 or 30 days per level.",
    legal_ref: "29 CFR 2560.503-1(i)(2); 45 CFR 147.136(b)(2)(ii)(B)",
    source_url: "https://www.law.cornell.edu/cfr/text/29/2560.503-1",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    priority: 40,
    why_template: "These limits apply to your plan once your appeal is received."
  },
  {
    id: "fed.claim_file.free_copies",
    jurisdiction: "federal",
    category: "right",
    title: "You can get your entire claim file for free",
    summary: "You have the right to receive, free of charge, copies of every document, record, and piece of information the plan used or relied on for your claim, including any internal rule, guideline, or protocol it applied.",
    legal_ref: "29 CFR 2560.503-1(h)(2)(iii), (g)(1)(v); 45 CFR 147.136(b)(2)(ii)(C)(1)",
    source_url: "https://www.law.cornell.edu/cfr/text/29/2560.503-1",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    priority: 20,
    why_template: "Asking for the file is often the single most useful first step: it shows exactly what the reviewer looked at and which criteria were used."
  },
  {
    id: "fed.claim_file.codes_meaning",
    jurisdiction: "federal",
    category: "right",
    title: "You can ask what the diagnosis and treatment codes mean",
    summary: "On request, the plan must tell you the diagnosis code and treatment code used for your claim and what each one means.",
    legal_ref: "45 CFR 147.136(b)(2)(ii)(E)(2)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any",
      denial_category: [
        "coding_admin",
        "not_covered",
        "duplicate",
        "other"
      ]
    },
    priority: 25,
    why_template: "When a denial turns on a code, seeing the code and its meaning is how you and your provider spot a mistake."
  },
  {
    id: "fed.internal_appeal.independent_reviewer",
    jurisdiction: "federal",
    category: "right",
    title: "A different, qualified person must review your appeal",
    summary: "The appeal must be decided by someone who did not make the original decision and who does not report to that person, with no deference to the first decision. For medical-judgment questions, the plan must consult a health professional with appropriate training and experience.",
    legal_ref: "29 CFR 2560.503-1(h)(3)(ii)-(iii)",
    source_url: "https://www.law.cornell.edu/cfr/text/29/2560.503-1",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 30,
    why_template: "Because your denial involves a medical judgment, you can ask who reviewed it and what their specialty is."
  },
  {
    id: "fed.notice.required_content",
    jurisdiction: "federal",
    category: "protection",
    title: "The denial letter itself must meet minimum standards",
    summary: "A denial notice must state the specific reason, cite the plan provision relied on, describe any extra information needed and why, explain the appeal steps, and either quote the internal criterion used or say you can get it free on request. A letter that skips these can be challenged.",
    legal_ref: "29 CFR 2560.503-1(g)(1); 45 CFR 147.136(b)(2)(ii)(E)",
    source_url: "https://www.law.cornell.edu/cfr/text/29/2560.503-1",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    priority: 50,
    why_template: "Compare your letter against this list; missing items are worth naming in your appeal."
  },
  {
    id: "fed.deemed_exhaustion",
    jurisdiction: "federal",
    category: "protection",
    title: "If the plan breaks its own procedure, you may skip ahead",
    summary: "When a plan fails to follow the required claims procedure (for example, misses its deadlines), you are generally treated as having finished the internal appeal, which opens the door to external review or court sooner. Minor, harmless slips do not count.",
    legal_ref: "29 CFR 2560.503-1(l); 45 CFR 147.136(b)(2)(ii)(F)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    priority: 60,
    why_template: "Keep a record of every date; if the plan misses one, this rule may apply."
  },
  {
    id: "fed.external_review.filing_window",
    jurisdiction: "federal",
    category: "deadline",
    title: "You have 4 months to request an independent external review",
    summary: "After the plan's final internal denial, you can ask for a review by an independent organization that the plan does not control. The request must be made within four months of receiving the final denial. The plan must follow the outcome.",
    legal_ref: "45 CFR 147.136(d)(2)(i)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth",
        "out_of_network",
        "other"
      ]
    },
    deadline: {
      anchor: "final_internal_denial_date",
      amount: 4,
      unit: "months",
      who: "consumer"
    },
    priority: 11,
    why_template: "External review covers denials that involve medical judgment (such as medical necessity, appropriateness, setting, or experimental status) and coverage rescissions.",
    caveat: "External review generally does not cover denials that turn only on plan terms with no medical judgment involved (for example, a benefit the plan simply excludes)."
  },
  {
    id: "fed.external_review.decision_windows",
    jurisdiction: "federal",
    category: "process",
    title: "The independent reviewer must decide within 45 days, or 72 hours if urgent",
    summary: "A standard external review decision is due within 45 days of the reviewer receiving the request. If your situation is urgent, an expedited external review must be decided as fast as your condition requires and never later than 72 hours.",
    legal_ref: "45 CFR 147.136(d)(2)(iii)(B)(6), (d)(3)(iv)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any"
    },
    priority: 41,
    why_template: "This is how long the outside review takes once it is filed."
  },
  {
    id: "fed.expedited.urgent_care",
    jurisdiction: "federal",
    category: "protection",
    title: "Urgent situations get a 72-hour fast track",
    summary: "If waiting would seriously jeopardize your life, health, or ability to regain function, or cause severe pain, you can ask for an expedited internal appeal (decided within 72 hours) and, at the same time, an expedited external review.",
    legal_ref: "45 CFR 147.136(b)(2)(ii)(B), (d)(3)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      self_funded: "any",
      urgent: true
    },
    priority: 5,
    why_template: 'You said the treatment is ongoing or urgent, so the fast track may apply; say the word "expedited" clearly in your request.'
  },
  {
    id: "fed.erisa.self_funded_route",
    jurisdiction: "federal",
    category: "process",
    title: "Self-funded employer plans use the federal external review process",
    summary: "If your employer pays claims itself (a self-funded plan), state insurance laws generally do not apply. Your external review goes through the federal process, and the U.S. Department of Labor (EBSA) is the agency that helps with these plans.",
    legal_ref: "29 U.S.C. 1144 (ERISA preemption); 45 CFR 147.136(d)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/147.136",
    last_verified: "2026-09-18",
    applies_if: {
      plan_source: [
        "employer"
      ],
      self_funded: "yes"
    },
    priority: 15,
    why_template: "This is the route for employer plans that pay their own claims (self-funded plans).",
    caveat: 'Not sure whether your plan is self-funded? Ask HR, or look at the Summary Plan Description; insurance cards for self-funded plans often say "administered by" rather than "insured by".'
  }
];

// ../data/rules/nsa.json
var nsa_default = [
  {
    id: "nsa.emergency.no_balance_billing",
    jurisdiction: "nsa",
    category: "protection",
    title: "Emergency care: no surprise bills, in-network cost sharing, no prior authorization",
    summary: "For emergency services, the No Surprises Act says your plan must cover the care without prior authorization even if the hospital or doctor was out of network, your share of the cost cannot be higher than the in-network amount, and the provider cannot bill you for the difference.",
    legal_ref: "45 CFR 149.110(b)(1), (b)(3)(ii); 45 CFR 149.410(a)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/149.110",
    last_verified: "2026-09-18",
    applies_if: { emergency: true },
    priority: 1,
    why_template: "You said this was emergency care, so these protections apply regardless of network status."
  },
  {
    id: "nsa.emergency.counts_in_network",
    jurisdiction: "nsa",
    category: "protection",
    title: "What you pay for out-of-network emergency care counts toward your in-network deductible",
    summary: "Any cost sharing you owe for protected emergency services must be counted toward your in-network deductible and in-network out-of-pocket maximum, as if the care had been in network.",
    legal_ref: "45 CFR 149.110(b)(3)(v)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/149.110",
    last_verified: "2026-09-18",
    applies_if: { emergency: true },
    priority: 6,
    why_template: "Check the EOB: the amount should be applied to your in-network totals, not a separate out-of-network bucket."
  },
  {
    id: "nsa.facility.oon_provider_at_in_network_facility",
    jurisdiction: "nsa",
    category: "protection",
    title: "Out-of-network doctor at an in-network hospital: in-network cost sharing applies",
    summary: "If you had non-emergency care at an in-network hospital or facility but a doctor there was out of network, your cost sharing is limited to the in-network level and that doctor cannot bill you the difference, unless you signed a valid advance notice-and-consent form.",
    legal_ref: "45 CFR 149.120(c)(1); 45 CFR 149.420(a)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/149.120",
    last_verified: "2026-09-18",
    applies_if: { denial_category: ["out_of_network"], emergency: false },
    priority: 2,
    why_template: "Your denial is about network status; if the facility itself was in network, this protection may apply.",
    caveat: "This applies when the facility was in your plan's network. If the facility was also out of network, the protection does not apply to non-emergency care."
  },
  {
    id: "nsa.facility.no_consent_for_ancillary",
    jurisdiction: "nsa",
    category: "protection",
    title: "Some specialties can never make you waive the protection",
    summary: "Providers of emergency medicine, anesthesiology, pathology, radiology, neonatology, diagnostic services, and assistant surgeons, hospitalists, and intensivists cannot use a consent form to bill you out-of-network rates at an in-network facility. Neither can a provider when no in-network alternative was available or the need was unforeseen and urgent.",
    legal_ref: "45 CFR 149.420(b)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/149.420",
    last_verified: "2026-09-18",
    applies_if: { denial_category: ["out_of_network"] },
    priority: 3,
    why_template: "If the out-of-network provider was an anesthesiologist, radiologist, pathologist, or similar, any consent form you signed does not count."
  },
  {
    id: "nsa.consent.timing",
    jurisdiction: "nsa",
    category: "protection",
    title: "A consent form only counts if it was given in time and in writing",
    summary: "For a notice-and-consent waiver to be valid, the provider had to give you written notice at least 72 hours before a scheduled service (or at least 3 hours before, for same-day scheduling) and you had to consent in writing.",
    legal_ref: "45 CFR 149.420(c)",
    source_url: "https://www.law.cornell.edu/cfr/text/45/149.420",
    last_verified: "2026-09-18",
    applies_if: { denial_category: ["out_of_network"], emergency: false },
    priority: 4,
    why_template: "If you were handed a form at check-in or after the fact, the waiver may not be valid."
  },
  {
    id: "nsa.complaint.help_desk",
    jurisdiction: "nsa",
    category: "process",
    title: "You can report a surprise bill to the federal No Surprises Help Desk",
    summary: "If a provider or plan is not following the No Surprises Act, you can submit a complaint to the federal government online or by phone; the Help Desk also answers questions about whether your bill is protected.",
    legal_ref: "No Surprises Act, Consolidated Appropriations Act 2021, Div. BB; CMS complaint process",
    source_url: "https://www.cms.gov/medical-bill-rights/help/submit-a-complaint",
    last_verified: "2026-09-18",
    applies_if: { denial_category: ["out_of_network"] },
    priority: 70,
    why_template: "This is a free federal channel, separate from your appeal to the plan."
  }
];

// ../data/rules/ca.json
var ca_default = [
  {
    id: "ca.imr.filing_window",
    jurisdiction: "CA",
    category: "deadline",
    title: "California: 6 months to apply for Independent Medical Review",
    summary: "If your plan denied, delayed, or modified care as not medically necessary, you can ask the Department of Managed Health Care for an Independent Medical Review (IMR). Apply within six months of the plan's written grievance decision; the department may accept later applications when circumstances warrant. The plan must follow the IMR decision.",
    legal_ref: "Cal. Health & Safety Code \xA7 1374.30(j), (k)",
    source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1374.30",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth",
        "out_of_network",
        "other"
      ]
    },
    deadline: {
      anchor: "final_internal_denial_date",
      amount: 6,
      unit: "months",
      who: "consumer"
    },
    priority: 12,
    why_template: "This applies to plans regulated by California (insured job-based plans, Marketplace and individual plans), for denials that turn on medical judgment.",
    caveat: "IMR applies to plans regulated by California (most HMOs and many PPOs through the DMHC; some PPO policies through the Department of Insurance, which runs a parallel review). Self-funded employer plans use the federal external review instead."
  },
  {
    id: "ca.imr.free",
    jurisdiction: "CA",
    category: "protection",
    title: "California IMR is free",
    summary: "You pay no application or processing fee of any kind for an Independent Medical Review.",
    legal_ref: "Cal. Health & Safety Code \xA7 1374.30(l)",
    source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1374.30",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth",
        "out_of_network",
        "other"
      ]
    },
    priority: 46,
    why_template: "There is no cost barrier to asking for an outside medical opinion in California."
  },
  {
    id: "ca.grievance.then_dmhc_30_days",
    jurisdiction: "CA",
    category: "process",
    title: "California: file a grievance with the plan first, then the DMHC after 30 days (or right away if urgent)",
    summary: "You generally start by filing a grievance (appeal) with your plan. If the plan does not resolve it within 30 days, or you disagree with the answer, you can take it to the Department of Managed Health Care. If the situation is an imminent and serious threat to your health, you can go to the department immediately.",
    legal_ref: "Cal. Health & Safety Code \xA7 1368(b)(1)(A)",
    source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1368",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no"
    },
    priority: 14,
    why_template: "This is the order of steps in California: plan grievance, then the state regulator."
  },
  {
    id: "ca.grievance.written_reasons",
    jurisdiction: "CA",
    category: "right",
    title: "California plans must explain the criteria and clinical reasons in writing",
    summary: "A plan's written response to a grievance must give a clear and concise explanation of its reasons, and for medical-necessity denials it must describe the criteria used and the clinical reasons for the decision.",
    legal_ref: "Cal. Health & Safety Code \xA7 1368(a)(5)",
    source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1368",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 23,
    why_template: "If your letter does not name the criteria and clinical reasons, you can point to this requirement."
  },
  {
    id: "ca.imr.decision_windows",
    jurisdiction: "CA",
    category: "process",
    title: "California IMR decisions usually take up to 30 days, or 7 days if urgent",
    summary: "According to the Department of Managed Health Care, the independent review organization usually decides within 30 days, or within 7 days when the case is urgent.",
    legal_ref: "DMHC Independent Medical Review program; Cal. Health & Safety Code \xA7 1374.33",
    source_url: "https://www.dmhc.ca.gov/FileaComplaint.aspx",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth",
        "out_of_network",
        "other"
      ]
    },
    priority: 43,
    why_template: "This is how long the California outside review takes once filed."
  },
  {
    id: "ca.regulator.which_one",
    jurisdiction: "CA",
    category: "process",
    title: "California has two health insurance regulators; check your card",
    summary: "Most California health plans (all HMOs and many PPOs) are regulated by the Department of Managed Health Care (DMHC). Some PPO and other insurance policies are regulated by the California Department of Insurance (CDI), which runs its own independent medical review. Your insurance card or plan documents say which one applies.",
    legal_ref: "Cal. Health & Safety Code \xA7 1374.30 (DMHC); Cal. Ins. Code \xA7 10169 (CDI)",
    source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=10169",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "CA"
      ],
      self_funded: "no"
    },
    priority: 48,
    why_template: "Knowing which regulator covers your plan tells you where to send the outside review request."
  }
];

// ../data/rules/ny.json
var ny_default = [
  {
    id: "ny.external_appeal.filing_window",
    jurisdiction: "NY",
    category: "deadline",
    title: "New York: 4 months to file an external appeal with DFS",
    summary: "After your plan's final denial on internal appeal, you can file a New York State External Appeal with the Department of Financial Services. The application must be sent within 4 months of the final adverse determination. An outside doctor decides, and the plan must follow the decision.",
    legal_ref: "N.Y. Ins. Law \xA7 4914; DFS External Appeal program",
    source_url: "https://www.dfs.ny.gov/ExternalAppeal/",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "NY"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "out_of_network",
        "prior_auth",
        "other"
      ]
    },
    deadline: {
      anchor: "final_internal_denial_date",
      amount: 4,
      unit: "months",
      who: "consumer"
    },
    priority: 12,
    why_template: "This applies to plans regulated by New York, which covers most job-based plans that are insured, and all Marketplace and individual plans in the state.",
    caveat: "State external appeal applies to plans regulated by New York. If your employer plan is self-funded, use the federal external review instead."
  },
  {
    id: "ny.external_appeal.scope",
    jurisdiction: "NY",
    category: "protection",
    title: "New York external appeal covers more than medical necessity",
    summary: "New York's external appeal can review denials for medical necessity, experimental or investigational treatment, out-of-network services, clinical trials, rare diseases, and formulary (drug) exceptions, as well as certain No Surprises Act disputes.",
    legal_ref: "N.Y. Ins. Law \xA7 4910; DFS External Appeal program",
    source_url: "https://www.dfs.ny.gov/ExternalAppeal/",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "NY"
      ],
      self_funded: "no"
    },
    priority: 22,
    why_template: "This tells you whether your kind of denial can go to an outside reviewer in New York."
  },
  {
    id: "ny.external_appeal.fee",
    jurisdiction: "NY",
    category: "process",
    title: "New York external appeal may cost up to $25, refunded if you win",
    summary: "A plan may charge up to $25 per external appeal (no more than $75 per plan year). The fee is waived for hardship and for Medicaid or Child Health Plus members, and it is returned if the denial is overturned.",
    legal_ref: "N.Y. Ins. Law \xA7 4914(b); DFS External Appeal program",
    source_url: "https://www.dfs.ny.gov/ExternalAppeal/",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "NY"
      ],
      self_funded: "no"
    },
    priority: 45,
    why_template: "Good to know before filing: the cost is small and refundable."
  },
  {
    id: "ny.external_appeal.decision_windows",
    jurisdiction: "NY",
    category: "process",
    title: "New York external appeal is decided in 30 days, or 72 hours if expedited",
    summary: "Standard external appeals are decided within 30 days. Expedited appeals are decided within 72 hours. You may ask for an expedited internal appeal and an expedited external appeal at the same time.",
    legal_ref: "N.Y. Ins. Law \xA7 4914(b); DFS External Appeal program",
    source_url: "https://www.dfs.ny.gov/ExternalAppeal/",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "NY"
      ],
      self_funded: "no"
    },
    priority: 42,
    why_template: "This is how long the New York outside review takes once filed."
  },
  {
    id: "ny.internal_appeal.deemed_reversal",
    jurisdiction: "NY",
    category: "protection",
    title: "New York: if the plan misses its appeal deadline, the denial is reversed",
    summary: "Under New York law, a utilization review agent that fails to decide your appeal within the required time (30 days for a standard appeal after receiving the necessary information; 2 business days for an expedited appeal) is deemed to have reversed its denial.",
    legal_ref: "N.Y. Ins. Law \xA7 4904(b), (c), (e)",
    source_url: "https://www.nysenate.gov/legislation/laws/ISC/4904",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "NY"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 21,
    why_template: "Write down the date you sent your appeal; New York's deadline for the plan is short and the consequence for missing it is strong."
  }
];

// ../data/rules/tx.json
var tx_default = [
  {
    id: "tx.internal_appeal.decision_30_days",
    jurisdiction: "TX",
    category: "process",
    title: "Texas: the plan must decide your appeal within 30 calendar days",
    summary: "A Texas utilization review agent must send written notice of its appeal decision as soon as practicable and no later than the 30th calendar day after it receives your appeal.",
    legal_ref: "Tex. Ins. Code \xA7 4201.359(a)",
    source_url: "https://texas.public.law/statutes/tex._ins._code_section_4201.359",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "TX"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 44,
    why_template: "Note the date you send the appeal; the plan's clock in Texas is 30 days."
  },
  {
    id: "tx.internal_appeal.notice_contents",
    jurisdiction: "TX",
    category: "right",
    title: "Texas: a denied appeal must state the clinical basis and the reviewer's specialty",
    summary: "If your appeal is denied, the written notice must include the clinical basis for the denial, the specialty of the provider who made the decision, and your right to seek review by an independent review organization along with the procedure to get it.",
    legal_ref: "Tex. Ins. Code \xA7 4201.359(b)",
    source_url: "https://texas.public.law/statutes/tex._ins._code_section_4201.359",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "TX"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 24,
    why_template: "If the appeal denial skips any of these, name it in your next step."
  },
  {
    id: "tx.iro.eligibility",
    jurisdiction: "TX",
    category: "protection",
    title: "Texas: medical-necessity and experimental denials can go to an Independent Review Organization",
    summary: "If the plan denies your appeal because the care is not medically necessary or appropriate, or is experimental or investigational, you can ask for review by a TDI-certified Independent Review Organization (IRO) using form LHL009, sent to the plan or its review agent. If your condition is life-threatening, you can request IRO review right after the first denial without waiting for the internal appeal.",
    legal_ref: "Tex. Ins. Code ch. 4201, subch. I; 28 Tex. Admin. Code \xA7 19.1717; TDI IRO FAQ",
    source_url: "https://www.tdi.texas.gov/hmo/mcqa/irofaqs.html",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "TX"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 13,
    why_template: "This applies to plans regulated by the Texas Department of Insurance, for denials that turn on medical judgment.",
    caveat: 'The IRO process applies to plans regulated by the Texas Department of Insurance (look for "TDI" or "DOI" on your insurance card). Self-funded employer plans, Medicare, Medicaid, and government employee plans are not covered; they use their own routes.'
  },
  {
    id: "tx.iro.free_and_timing",
    jurisdiction: "TX",
    category: "process",
    title: "Texas IRO review is paid by the insurer and decided in 20 days, or 3 days if life-threatening",
    summary: "The plan or its review agent pays for the independent review. The IRO decides within 20 days for standard cases and within 3 days for life-threatening cases.",
    legal_ref: "28 Tex. Admin. Code \xA7 19.1717; TDI IRO FAQ",
    source_url: "https://www.tdi.texas.gov/hmo/mcqa/irofaqs.html",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "TX"
      ],
      self_funded: "no",
      denial_category: [
        "medical_necessity",
        "experimental",
        "prior_auth"
      ]
    },
    priority: 47,
    why_template: "There is no cost to you and the outside review is fast."
  },
  {
    id: "tx.regulator.scope",
    jurisdiction: "TX",
    category: "process",
    title: 'Texas: TDI helps with plans that show "TDI" or "DOI" on the card',
    summary: 'The Texas Department of Insurance regulates plans whose insurance card shows "TDI" or "DOI". It does not regulate Medicare, Medicaid, most CHIP plans, military plans, or city, county, state, federal employee, and teacher plans; those have their own appeal routes.',
    legal_ref: "Texas Department of Insurance consumer guidance",
    source_url: "https://www.tdi.texas.gov/consumer/complaint-health.html",
    last_verified: "2026-09-18",
    applies_if: {
      state: [
        "TX"
      ],
      self_funded: "no"
    },
    priority: 49,
    why_template: "This tells you whether the Texas regulator is the right place to call."
  }
];

// ../data/help-resources.json
var help_resources_default = [
  {
    id: "fed.cms.cap_list",
    scope: "federal",
    name: "Consumer Assistance Programs (by state)",
    kind: "CAP",
    url: "https://www.cms.gov/cciio/resources/consumer-assistance-grants",
    what_they_do: "Free, government-funded programs in many states that help people file appeals and understand their coverage. Find the one for your state on this list."
  },
  {
    id: "fed.dol.ebsa",
    scope: "federal",
    name: "U.S. Department of Labor, EBSA",
    kind: "regulator",
    phone: "1-866-444-3272",
    url: "https://www.dol.gov/agencies/ebsa/about-ebsa/ask-a-question/ask-ebsa",
    what_they_do: "Benefits advisors who help with job-based health plans, including self-funded (ERISA) plans that state regulators cannot help with."
  },
  {
    id: "fed.cms.no_surprises_help_desk",
    scope: "federal",
    name: "No Surprises Help Desk",
    kind: "helpdesk",
    phone: "1-800-985-3059",
    url: "https://www.cms.gov/medical-bill-rights/help",
    what_they_do: "Federal help desk for surprise medical bills: answers whether a bill is protected under the No Surprises Act and takes complaints. Open 7 days a week, many languages."
  },
  {
    id: "ca.dmhc.help_center",
    scope: "CA",
    name: "DMHC Help Center",
    kind: "regulator",
    phone: "1-888-466-2219",
    url: "https://www.dmhc.ca.gov/FileaComplaint.aspx",
    what_they_do: "California's regulator for most health plans. Helps with grievances, Independent Medical Review applications, and complaints. Free."
  },
  {
    id: "ca.cdi.hotline",
    scope: "CA",
    name: "California Department of Insurance consumer hotline",
    kind: "regulator",
    phone: "1-800-927-4357",
    url: "https://www.insurance.ca.gov/01-consumers/",
    what_they_do: "Regulator for California insurance policies not covered by the DMHC (some PPOs). Handles complaints and its own independent medical review."
  },
  {
    id: "ny.cha",
    scope: "NY",
    name: "Community Health Advocates",
    kind: "CAP",
    phone: "1-888-614-5400",
    url: "https://communityhealthadvocates.org/",
    what_they_do: "New York's free Consumer Assistance Program. Advocates help you understand denials, file internal and external appeals, and deal with medical bills."
  },
  {
    id: "ny.dfs",
    scope: "NY",
    name: "New York Department of Financial Services",
    kind: "regulator",
    phone: "1-800-400-8882",
    url: "https://www.dfs.ny.gov/ExternalAppeal/",
    what_they_do: "New York's insurance regulator. Runs the External Appeal program and takes complaints about health plans."
  },
  {
    id: "tx.tdi.help_line",
    scope: "TX",
    name: "Texas Department of Insurance Consumer Help Line",
    kind: "regulator",
    phone: "1-800-252-3439",
    url: "https://www.tdi.texas.gov/consumer/complaint-health.html",
    what_they_do: "Texas's insurance regulator. Explains appeals and independent review, and takes complaints about plans it regulates."
  }
];

// ../lib/rules/schema.ts
import { z as z2 } from "zod";

// ../lib/schemas/core.ts
import { z } from "zod";
var ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
var US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY"
];
var USStateCode = z.enum(US_STATES);
var DenialCategory = z.enum([
  "medical_necessity",
  "prior_auth",
  "out_of_network",
  "not_covered",
  "coding_admin",
  "experimental",
  "timely_filing",
  "duplicate",
  "other"
]);
var PlanSource = z.enum(["employer", "marketplace", "direct", "other"]);
var YesNoUnknown = z.enum(["yes", "no", "unknown"]);
var DocumentType = z.enum(["denial_letter", "eob", "other"]);
var ProgramSignal = z.enum(["commercial", "medicare", "medicaid", "tricare", "unknown"]);
var NetworkStatus = z.enum(["in_network", "out_of_network", "unknown"]);

// ../lib/rules/schema.ts
var Jurisdiction = z2.enum(["federal", "nsa", "CA", "NY", "TX"]);
var RuleCategory = z2.enum(["deadline", "protection", "right", "process"]);
var DeadlineAnchor = z2.enum(["letter_date", "final_internal_denial_date", "service_date"]);
var AppliesIf = z2.object({
  state: z2.array(USStateCode).optional(),
  plan_source: z2.array(PlanSource).optional(),
  /** "any" = regardless; "yes"/"no" = only that funding type (shown with caveat when unknown). */
  self_funded: z2.enum(["yes", "no", "any"]).optional(),
  denial_category: z2.array(DenialCategory).optional(),
  emergency: z2.boolean().optional(),
  urgent: z2.boolean().optional(),
  document_type: z2.array(DocumentType).optional()
}).strict();
var Deadline = z2.object({
  anchor: DeadlineAnchor,
  amount: z2.number().positive(),
  unit: z2.enum(["days", "months", "hours"]),
  who: z2.enum(["consumer", "insurer"])
}).strict();
var Rule = z2.object({
  id: z2.string().regex(/^[a-z]+(\.[a-z0-9_]+)+$/, "id like fed.internal_appeal.filing_window"),
  jurisdiction: Jurisdiction,
  category: RuleCategory,
  title: z2.string().min(4),
  summary: z2.string().min(20),
  legal_ref: z2.string().min(3),
  source_url: z2.string().url().startsWith("https://"),
  last_verified: ISODate,
  applies_if: AppliesIf,
  deadline: Deadline.optional(),
  priority: z2.number().int().min(0),
  why_template: z2.string().min(10),
  caveat: z2.string().optional()
}).strict();
var RuleFile = z2.array(Rule);
var HelpResource = z2.object({
  id: z2.string(),
  scope: z2.union([z2.literal("federal"), USStateCode]),
  name: z2.string(),
  kind: z2.enum(["CAP", "regulator", "ombudsman", "helpdesk"]),
  phone: z2.string().optional(),
  url: z2.string().url().startsWith("https://"),
  what_they_do: z2.string().min(10)
}).strict();
var HelpResourceFile = z2.array(HelpResource);

// ../lib/rules/load.ts
var RULE_FILES = { federal: federal_default, nsa: nsa_default, ca: ca_default, ny: ny_default, tx: tx_default };
var ALL_RULES = Object.values(RULE_FILES).flatMap((file) => RuleFile.parse(file));
var HELP_RESOURCES = HelpResourceFile.parse(help_resources_default);
var ids = ALL_RULES.map((r) => r.id);
var dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`Duplicate rule ids: ${dupes.join(", ")}`);

// src/server.ts
var PROTOCOL_VERSION = "2025-11-25";
function createApp() {
  const app2 = new Hono();
  app2.get(
    "/healthz",
    (c) => c.json({
      ok: true,
      protocol: PROTOCOL_VERSION,
      // Proves the shared engine loaded: the rules dataset is imported through the `@/` alias
      // from ../lib, under the react-server condition that neutralises `server-only`.
      rules: ALL_RULES.length
    })
  );
  return app2;
}

// src/index.ts
var port = Number(process.env.MCP_PORT ?? 8e3);
var app = createApp();
var server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.error(JSON.stringify({
    t: (/* @__PURE__ */ new Date()).toISOString(),
    level: "info",
    event: "listening",
    port: info.port,
    path: process.env.MCP_PATH ?? "/mcp",
    authMode: process.env.MCP_AUTH_MODE ?? "cognito"
  }));
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.error(JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level: "info", event: "shutdown", signal }));
    server.close(() => process.exit(0));
  });
}
//# sourceMappingURL=index.js.map
