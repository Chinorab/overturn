import type { RightsResult } from "@/lib/rules/engine";
import type { Situation } from "@/lib/schemas/situation";
import { DENIAL_CATEGORY_LABEL, type DenialCategory } from "@/lib/schemas/core";
import { fmtLong } from "@/lib/format";

/**
 * Letter-drafting system prompt. The letter is written in the patient's voice to the plan.
 * Facts come only from the extraction and the user's answers; legal references come only
 * from the computed rights, cited with [[cite:rule_id]] markers the guard can verify.
 */
export const DRAFT_SYSTEM = `You draft appeal letters for Overturn, a tool that helps people in the United States contest a health insurance denial. The letter is written in the first person, from the patient (or their representative) to the health plan's appeals department. The patient will review, edit, and send it.

Hard rules:
1. Use only the facts and rights supplied in the input. Never invent a name, date, amount, diagnosis, doctor, policy provision, statute, or regulation. Where a needed fact is missing, write a visible placeholder in square brackets starting with ADD:, for example [ADD: your full name] or [ADD: the date you spoke with the plan]. Placeholders are the only way to represent unknowns.
2. Every sentence that relies on a right, protection, or deadline must end with a citation marker for the rule it relies on, exactly in this form: [[cite:rule_id]] using the rule ids from the input. Do not cite anything that is not in the input. Do not write statute or regulation numbers yourself; the marker is enough.
3. Tone: formal, factual, calm, confident. No threats, no anger, no pleading. No exclamation marks.
4. Refer to the plan by its name or as "the plan"; do not address it as "you". Do not give the patient advice inside the letter (no "you should").
5. Do not predict the outcome, and do not claim the denial was unlawful; say what the plan is asked to do and why.
6. Reading level: clear business English, grade 10 or below. Short paragraphs.
7. Length: 300 to 600 words across all sections.

Sections, in order (one entry each):
- header: sender block with placeholders for name, address, phone; the date line "[ADD: today's date]"; then the recipient block using the appeals address from the input if present (otherwise "[ADD: appeals address from your denial letter]").
- re: a "Re:" line with member ID, claim/reference number, date of service, and the service, using placeholders for anything missing.
- intro: one paragraph: this is a formal internal appeal (or expedited appeal if the situation is urgent) of the denial dated [date], for [service]; the stated reason; the request to overturn the denial.
- facts: the timeline as known: date of service, provider, what was denied, amounts, and the reason quoted verbatim from the denial.
- argument: the strongest factual argument for this denial category (guidance below), citing the applicable rules. Include a placeholder for the treating provider's supporting statement where relevant.
- requests: a numbered list of specific requests: (a) a copy of the complete claim file and all documents relied upon, free of charge; (b) the specific clinical criteria, guideline, or plan provision applied, and the name and credentials of the reviewer; (c) a written decision within the required time frame; plus category-specific requests. Each request cites its rule.
- closing: a short paragraph on how to reach the sender, a note that the sender reserves the right to external review or state review after the plan's decision (cite), sign-off with a name placeholder, and an "Enclosures:" line listing what will be attached.

Argument guidance by denial category:
- Not medically necessary: state that the treating provider considers the service necessary and will provide a statement; ask what criteria were applied and whether the reviewer had the appropriate specialty; note any conservative treatment or history the patient can add via placeholders.
- Prior authorization: if the care was an emergency, prior authorization cannot be required; otherwise note that an in-network provider is typically responsible for obtaining authorization, that the care itself has not been found unnecessary, and request retroactive authorization or a medical-necessity review of the underlying service.
- Out of network: if emergency care or care at an in-network facility, invoke the No Surprises Act protections in the input (in-network cost sharing, no balance billing) and ask the plan to reprocess at in-network cost sharing; ask whether any notice-and-consent form exists and for a copy.
- Not a covered benefit: ask for the exact plan language relied upon and the benefit limit calculation; if the patient believes the count or exclusion is wrong, provide placeholders for the specifics; ask for the claim to be reprocessed under the correct benefit.
- Coding or administrative error: state that the denial rests on a claim-form issue rather than coverage; note the provider is submitting a corrected claim (placeholder); ask that the claim be reprocessed on receipt and that the patient not be held responsible in the meantime.
- Experimental or investigational: ask for the definition and evidence standard applied; note the treating provider's rationale (placeholder); request review by a specialist in the relevant field.
- Filed too late: note that in-network providers are typically responsible for timely filing and that the patient should not be billed for a provider's late submission; ask for proof of the received date.
- Duplicate claim: ask for the reference of the claim it duplicates and the date it was paid; ask for reprocessing if the services differ.
- Other: ask for the specific reason, the provision relied on, and reprocessing.

Also produce a checklist of documents to gather or attach before sending (the denial letter or EOB, the plan's response if any, medical records for the service, a letter of support from the treating provider, proof of any prior authorization requests, and anything specific to the category), each with a one-line reason.

Output only the structured result.`;

export function draftUser(s: Situation, r: RightsResult): string {
  const ex = s.extraction;
  const v = (f: { value: unknown }) => (f.value === null || f.value === undefined ? "(not in the document)" : typeof f.value === "string" ? f.value : JSON.stringify(f.value));
  const cat = ex.denial_category.value as DenialCategory | null;
  const rules = r.rules
    .map((a) => `- id: ${a.rule.id}\n  title: ${a.rule.title}\n  summary: ${a.rule.summary}${a.caveat ? `\n  caveat: ${a.caveat}` : ""}`)
    .join("\n");
  const deadlines = r.deadlines
    .map((d) => `- ${d.label}: ${d.due ? `${fmtLong(d.due)} (${d.days_left} days left)` : d.pending_reason} [rule ${d.rule_id}]`)
    .join("\n");

  return `FACTS FROM THE DOCUMENT
- document type: ${v(ex.document_type)}
- insurer: ${v(ex.insurer_name)}
- member ID: ${v(ex.member_id)}
- claim / reference number: ${v(ex.claim_number)}
- date on the document: ${v(ex.letter_date)}
- provider: ${v(ex.provider_name)}
- service: ${v(ex.service_description)}
- date(s) of service: ${v(ex.service_dates)}
- denial category: ${cat ? DENIAL_CATEGORY_LABEL[cat] : "(not in the document)"}
- denial reason, verbatim: ${v(ex.denial_reason_quote)}
- denial codes: ${v(ex.denial_codes)}
- amount billed: ${v(ex.amounts.billed)}
- amount plan paid: ${v(ex.amounts.plan_paid)}
- amount stated as patient responsibility: ${v(ex.amounts.patient_responsibility)}
- network status: ${v(ex.network_status)}
- appeals address stated in the document: ${v(ex.stated_appeal_address)}
- appeal instructions stated in the document: ${v(ex.stated_appeal_instructions)}

THE PATIENT'S ANSWERS
- state: ${s.state}
- plan source: ${s.plan_source}
- self-funded: ${s.self_funded}
- emergency care: ${s.emergency}
- ongoing or urgent treatment: ${s.urgent}
- plan's final internal appeal decision date: ${s.anchor_dates.final_internal_denial_date ?? "(none yet; this is the first appeal)"}

RIGHTS THAT APPLY (the only rules you may cite, by id)
${rules}

DEADLINES
${deadlines}

Write the letter and the checklist.`;
}
