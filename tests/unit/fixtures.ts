import type { Extraction, Field } from "@/lib/schemas/extraction";
import type { Situation } from "@/lib/schemas/situation";

export const f = <T>(value: T | null, confidence = 0.95): Field<T> => ({
  value,
  confidence,
  quote: value === null ? null : String(value),
  page: value === null ? null : 1,
});

export function extraction(over: Partial<Extraction> = {}): Extraction {
  return {
    document_type: f("denial_letter" as const),
    program_signals: f("commercial" as const),
    insurer_name: f("Meridian Health Plan"),
    member_id: f("MHP-0000-1111"),
    claim_number: f("CLM-2026-000123"),
    letter_date: f("2026-09-01"),
    provider_name: f("Riverside Orthopedics"),
    service_description: f("MRI of the left knee"),
    service_dates: f(["2026-08-20"]),
    denial_category: f("medical_necessity" as const),
    denial_reason_quote: f("The requested service is not medically necessary."),
    denial_codes: f(["50"]),
    amounts: {
      billed: f(2400),
      allowed: f(null),
      plan_paid: f(0),
      patient_responsibility: f(2400),
    },
    network_status: f("in_network" as const),
    emergency_signals: f(false),
    urgency_signals: f(false),
    stated_appeal_deadline: f(null),
    stated_appeal_address: f("Appeals Unit, PO Box 1, Albany, NY 12201"),
    stated_appeal_instructions: f("Send a written appeal to the Appeals Unit."),
    state_hint: f("NY" as const),
    ...over,
  };
}

export function situation(over: Partial<Situation> = {}, ex: Partial<Extraction> = {}): Situation {
  return {
    extraction: extraction(ex),
    state: "NY",
    plan_source: "employer",
    self_funded: "unknown",
    emergency: "no",
    urgent: "no",
    anchor_dates: { letter_date: "2026-09-01" },
    today: "2026-09-18",
    ...over,
  };
}
