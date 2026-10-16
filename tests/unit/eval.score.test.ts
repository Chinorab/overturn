import { describe, expect, it } from "vitest";
import type { Extraction } from "@/lib/schemas/extraction";
import { groundQuotes, sameText, scoreCase, summarize } from "../../scripts/eval/score";
import type { LetterSource, Truth } from "../../scripts/eval/types";

const source: LetterSource = {
  kind: "letter",
  insurer: { name: "Quillfield Health Plan", address: "PO Box 4410, Buffalo, NY 14202", phone: "1-800-555-0142", logo_text: "QUILLFIELD" },
  date: "2026-09-08",
  member: { name: "Maria Alvarez", address: "418 Willow Court\nYonkers, NY 10701", member_id: "QUI-448201-07", group: "GRP-77120 (Hudson Valley Logistics, Inc.)" },
  re: { claim_number: "CLM-26-0917-55831", provider: "Riverside Orthopedic Associates", service: "MRI of the left knee without contrast (CPT 73721)", service_date: "2026-08-20", billed: "2,400.00" },
  title: "Notice of Adverse Benefit Determination",
  paragraphs: [
    "We reviewed the claim submitted by Riverside Orthopedic Associates under your health plan for services provided on August 20, 2026.",
    "Reason for denial: The MRI of the left knee without contrast is not medically necessary. Reason code: CO-50.",
    "The plan paid $0.00 of the $2,400.00 billed. The provider may bill you for this service.",
  ],
  appeal: {
    heading: "Your Right to Appeal",
    text: "You may file a written appeal within 180 days of the date you receive this notice. If waiting for a standard decision could seriously harm your health, you may ask for an expedited appeal.",
    external: "You may have the right to an independent external review.",
  },
  signature: "Utilization Management Department",
};

const truth: Truth = {
  id: "t-1",
  kind: "letter",
  category: "medical_necessity",
  traps: ["vague_owed", "boilerplate_expedited"],
  expected: {
    document_type: "denial_letter",
    program_signals: "commercial",
    insurer_name: "Quillfield Health Plan",
    member_id: "QUI-448201-07",
    claim_number: "CLM-26-0917-55831",
    letter_date: "2026-09-08",
    provider_name: "Riverside Orthopedic Associates",
    service: { text: "MRI of the left knee without contrast", cpt: "73721" },
    service_dates: ["2026-08-20"],
    denial_category: "medical_necessity",
    denial_codes: ["CO-50"],
    amounts: { billed: 2400, allowed: null, plan_paid: 0, patient_responsibility: null },
    network_status: "unknown",
    emergency_signals: false,
    urgency_signals: false,
    stated_appeal_deadline: { kind: "days", days: 180 },
    state_hint: "NY",
  },
};

const f = <T,>(value: T | null, quote: string | null = null) => ({ value, confidence: 0.9, quote, page: value === null ? null : 1 });

/** What a perfect reading of `source` returns. Each test breaks one thing on purpose. */
function perfect(): Extraction {
  return {
    document_type: f("denial_letter" as const, "Notice of Adverse Benefit Determination"),
    program_signals: f("commercial" as const, "GRP-77120 (Hudson Valley Logistics, Inc.)"),
    insurer_name: f("Quillfield Health Plan", "Quillfield Health Plan"),
    member_id: f("QUI-448201-07", "Member ID: QUI-448201-07"),
    claim_number: f("CLM-26-0917-55831", "CLM-26-0917-55831"),
    letter_date: f("2026-09-08", "September 8, 2026"),
    provider_name: f("Riverside Orthopedic Associates", "Riverside Orthopedic Associates"),
    service_description: f("MRI of the left knee without contrast (CPT 73721)", "MRI of the left knee without contrast (CPT 73721)"),
    service_dates: f(["2026-08-20"], "August 20, 2026"),
    denial_category: f("medical_necessity" as const, "is not medically necessary"),
    denial_reason_quote: f("The MRI of the left knee without contrast is not medically necessary.", "is not medically necessary"),
    denial_codes: f(["CO-50"], "Reason code: CO-50"),
    amounts: { billed: f(2400, "$2,400.00 billed"), allowed: f<number>(null), plan_paid: f(0, "The plan paid $0.00"), patient_responsibility: f<number>(null) },
    network_status: f<"in_network" | "out_of_network" | "unknown">(null),
    emergency_signals: f<boolean>(null),
    urgency_signals: f<boolean>(null),
    stated_appeal_deadline: f({ kind: "days" as const, days: 180 }, "within 180 days"),
    stated_appeal_address: f<string>(null),
    stated_appeal_instructions: f<string>(null),
    state_hint: f("NY" as const, "Yonkers, NY 10701"),
  } as Extraction;
}

const verdict = (ex: Extraction, field: string) => scoreCase(truth, ex, source).fields.find((x) => x.field === field)?.verdict;

describe("extraction eval scoring", () => {
  it("scores a perfect reading as all correct, with every quote on the page", () => {
    const r = scoreCase(truth, perfect(), source);
    expect(r.fields.filter((x) => x.verdict !== "correct")).toEqual([]);
    expect(r.grounding.checked).toBeGreaterThan(10);
    expect(r.grounding.grounded).toBe(r.grounding.checked);
  });

  it("calls a filled 'amount you may owe' a hallucination when the letter gives no figure", () => {
    const ex = perfect();
    ex.amounts.patient_responsibility = f(2400, "The provider may bill you for this service.");
    expect(verdict(ex, "amounts.patient_responsibility")).toBe("hallucination");
  });

  it("calls boilerplate read as an urgent case a hallucination", () => {
    const ex = perfect();
    ex.urgency_signals = f(true, "you may ask for an expedited appeal");
    expect(verdict(ex, "urgency_signals")).toBe("hallucination");
  });

  it("treats a commercial plan read as Medicare as wrong, and 'unknown' as harmless", () => {
    const ex = perfect();
    ex.program_signals = f("medicare" as const, "your health plan");
    expect(verdict(ex, "program_signals")).toBe("wrong");
    ex.program_signals = f("unknown" as const, null);
    expect(verdict(ex, "program_signals")).toBe("correct");
  });

  it("separates a miss from a wrong value", () => {
    const ex = perfect();
    ex.claim_number = f<string>(null);
    expect(verdict(ex, "claim_number")).toBe("miss");
    ex.claim_number = f("CLM-26-0917-55832", "CLM-26-0917-55832");
    expect(verdict(ex, "claim_number")).toBe("wrong");
  });

  it("checks the deadline by kind and value, not just presence", () => {
    const ex = perfect();
    ex.stated_appeal_deadline = f({ kind: "days" as const, days: 60 }, "within 180 days");
    expect(verdict(ex, "stated_appeal_deadline")).toBe("wrong");
  });

  it("flags a quote that is not on the page", () => {
    const ex = perfect();
    ex.denial_reason_quote = f("Coverage was denied pending peer-to-peer consultation.", "Coverage was denied pending peer-to-peer consultation.");
    const g = groundQuotes(ex, source);
    expect(g.ungrounded.map((u) => u.field)).toEqual(["denial_reason_quote"]);
  });

  it("matches names written a little differently, but not different names", () => {
    expect(sameText("Riverside Orthopedic Associates", "Riverside Orthopedic Associates, PLLC (non-participating)")).toBe(true);
    expect(sameText("Riverside Orthopedic Associates", "Northgate Imaging Center")).toBe(false);
  });

  it("rolls traps up against the field each one targets", () => {
    const ex = perfect();
    ex.amounts.patient_responsibility = f(2400, "$2,400.00 billed");
    const s = summarize([scoreCase(truth, ex, source)]);
    expect(s.byTrap.vague_owed).toEqual({ field: "amounts.patient_responsibility", correct: 0, total: 1 });
    expect(s.byTrap.boilerplate_expedited).toEqual({ field: "urgency_signals", correct: 1, total: 1 });
    expect(s.overall.hallucination).toBe(1);
  });
});
