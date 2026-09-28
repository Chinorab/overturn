/**
 * Templated spoken read-backs. Pure. Never calls a model: what is spoken is what was extracted.
 * Limits: a document read-back is ≤ 40 words and ends with "Is that right?" (FR-003, voice-design §1).
 */
import type { Extraction } from "@/lib/schemas/extraction";
import type { DenialCategory } from "@/lib/schemas/core";
import { spokenDate, spokenMoney, countWords } from "./spoken";

export type ReadbackField = "insurer" | "service" | "date" | "amount" | "reason";

export type Readback = {
  spoken: string;
  fields: Partial<Record<ReadbackField, string>>;
  /** True when the read-back had to drop the amount clause to stay ≤ 40 words. */
  trimmed: boolean;
};

const REASON_CLAUSE: Record<DenialCategory, string> = {
  medical_necessity: "saying it was not medically necessary",
  prior_auth: "because prior authorization wasn't obtained",
  out_of_network: "because the provider was out of network",
  not_covered: "saying it isn't a covered benefit",
  coding_admin: "citing a coding or paperwork problem",
  experimental: "calling it experimental or investigational",
  timely_filing: "because the claim was filed too late",
  duplicate: "calling it a duplicate claim",
  other: "for the reason given on the letter",
};

/** "Laparoscopic cholecystectomy (CPT 47562)" → "laparoscopic cholecystectomy"; two services → first + "and more". */
export function spokenService(desc: string | null): string {
  if (!desc) return "a service";
  const parts = desc.split(/;\s*/).map((p) => p.replace(/\s*\((?:CPT|HCPCS|ICD)[^)]*\)/gi, "").trim()).filter(Boolean);
  const first = parts[0] ?? "a service";
  const acronym = /^[A-Z]{2,}\b/.test(first);
  const lower = acronym ? first : first.charAt(0).toLowerCase() + first.slice(1);
  // "an" before a vowel, or before an acronym whose letter name starts with a vowel sound (F, H, L, M, N, R, S, X)
  const article = acronym ? (/^[AEFHILMNORSX]/.test(lower) ? "an" : "a") : (/^[aeiou]/i.test(lower) ? "an" : "a");
  return parts.length > 1 ? `${article} ${lower} and more` : `${article} ${lower}`;
}

export function documentReadback(ex: Extraction, today: string): Readback {
  const insurer = ex.insurer_name.value ?? "The plan";
  const service = spokenService(ex.service_description.value);
  const date = ex.service_dates.value?.[0] ? spokenDate(ex.service_dates.value[0], today) : null;
  const billed = ex.amounts.billed.value;
  const owed = ex.amounts.patient_responsibility.value;
  const cat = ex.denial_category.value ?? "other";
  const reason = REASON_CLAUSE[cat];
  const isEob = ex.document_type.value === "eob";

  const fields: Readback["fields"] = { insurer, service: service.replace(/^an? /, ""), reason: reason };
  if (date) fields.date = date;
  if (billed != null) fields.amount = spokenMoney(billed);

  const build = (withAmount: boolean) => {
    const when = date ? ` from ${date}` : "";
    let amount = "";
    if (withAmount) {
      if (isEob && owed != null) amount = `, leaving you ${spokenMoney(owed)} to pay`;
      else if (billed != null) amount = `, billed at ${spokenMoney(billed)}`;
    }
    const verb = isEob ? "didn't fully pay for" : "denied";
    return `Here's what I read: ${insurer} ${verb} ${service}${when}${amount}, ${reason}. Is that right?`;
  };

  let spoken = build(true);
  let trimmed = false;
  if (countWords(spoken) > 40) { spoken = build(false); trimmed = true; }
  return { spoken, fields, trimmed };
}

/** No-document path: read back the spoken answers before computing rights. */
export function answersReadback(a: { state: string; plan_source: string; denial_category: DenialCategory; approxDate: string | null }, today: string): Readback {
  const src = { employer: "coverage through your employer", marketplace: "coverage through the Marketplace", direct: "coverage bought directly", other: "other coverage" }[a.plan_source] ?? a.plan_source;
  const why = REASON_CLAUSE[a.denial_category].replace(/^(saying|because|calling|citing|for) /, "");
  const when = a.approxDate ? `, letter around ${spokenDate(a.approxDate, today)}` : "";
  const spoken = `So far: ${a.state}, ${src}, denied ${REASON_CLAUSE[a.denial_category]}${when}. Is that right?`;
  void why;
  return { spoken, fields: { reason: REASON_CLAUSE[a.denial_category] }, trimmed: false };
}

/** Re-read exactly one corrected field. */
export function fieldReadback(field: ReadbackField, value: string, note?: string): string {
  const lead: Record<ReadbackField, string> = {
    insurer: `The insurer is ${value}.`,
    service: `The service is ${value}.`,
    date: `The date is ${value}.`,
    amount: `The amount is ${value}.`,
    reason: `The reason is ${value}.`,
  };
  return `${lead[field]}${note ? ` ${note}` : ""} The rest stays as I read it. Better?`;
}

/** Spoken confirmation of one answer, folded into the next question by the caller. */
export function answerEcho(field: string, value: string): string {
  const echo: Record<string, string> = {
    state: value,
    plan_source: { employer: "Through your employer", marketplace: "Through the Marketplace", direct: "Bought directly", other: "Other coverage" }[value] ?? value,
    self_funded: { yes: "Self-funded", no: "Insured", unknown: "That's fine" }[value] ?? value,
    emergency: { yes: "An emergency", no: "Not an emergency", unknown: "That's fine" }[value] ?? value,
    urgent: { yes: "Urgent", no: "Not urgent" }[value] ?? value,
  };
  return `${echo[field] ?? value}.`;
}
