import type { Extraction } from "@/lib/schemas/extraction";
import { DENIAL_CATEGORY_LABEL } from "@/lib/schemas/core";

/**
 * Explanation system prompt. Descriptive, not prescriptive. It explains what the document
 * says; rights and deadlines are computed elsewhere and are not part of this call.
 */
export const EXPLAIN_SYSTEM = `You write short, calm, plain-English explanations for Overturn, a tool that helps people in the United States understand a health insurance denial letter or Explanation of Benefits.

The reader is probably stressed, not a lawyer, and reading on a phone. Write for an 8th-grade reading level: short sentences, common words, no legal citations.

Hard rules:
- Describe what the document says. Do not tell the reader what they should or must do, do not predict whether an appeal would succeed, and do not offer opinions on whether the plan was right.
- Do not use these words or phrases: "you should", "you must", "you need to", "I recommend", "I advise", "guaranteed", "will win", "will succeed", "legal advice".
- Use only the facts provided. If something is unknown, say it is not stated in the document.
- 120 words or fewer for "summary". Second person ("your plan", "your claim").
- Define every piece of jargon you use in "terms" (for example: prior authorization, medical necessity, allowed amount, explanation of benefits, out-of-network). One short sentence each, using the definitions provided when one exists.
- Refer to money with a dollar sign and no cents unless cents matter.
- No exclamation marks. No "unfortunately". No "congratulations".`;

export function explainUser(ex: Extraction, glossary: Record<string, string>): string {
  const g = (k: keyof Extraction) => {
    const f = ex[k] as { value: unknown } | undefined;
    return f && f.value !== null && f.value !== undefined ? JSON.stringify(f.value) : "not stated";
  };
  const cat = ex.denial_category.value;
  return `Facts read from the document (JSON values, or "not stated"):
- document type: ${g("document_type")}
- insurer: ${g("insurer_name")}
- provider: ${g("provider_name")}
- service: ${g("service_description")}
- date(s) of service: ${g("service_dates")}
- date of letter: ${g("letter_date")}
- denial category: ${cat ? DENIAL_CATEGORY_LABEL[cat] : "not stated"}
- denial reason, verbatim: ${g("denial_reason_quote")}
- denial codes: ${g("denial_codes")}
- amount billed: ${ex.amounts.billed.value ?? "not stated"}
- amount plan paid: ${ex.amounts.plan_paid.value ?? "not stated"}
- amount the document says the patient may owe: ${ex.amounts.patient_responsibility.value ?? "not stated"}
- network status: ${g("network_status")}
- appeal instructions in the document: ${g("stated_appeal_instructions")}
- appeal deadline stated in the document: ${g("stated_appeal_deadline")}

Glossary you may reuse for "terms":
${Object.entries(glossary)
  .map(([t, d]) => `- ${t}: ${d}`)
  .join("\n")}

Write the summary and the terms.`;
}
