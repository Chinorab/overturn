/**
 * Shapes shared by the extraction eval: the synthetic document sources (the same format the
 * sample PDFs are rendered from) and the ground truth each one was generated with.
 *
 * The truth is known by construction: the generator decides every fact first, then writes the
 * document around it. No model ever labels a case.
 */
import type { DenialCategory } from "@/lib/schemas/core";

export type Insurer = { name: string; address: string; phone: string; logo_text: string };
export type Member = { name: string; address: string; member_id: string; group: string };

export type LetterSource = {
  kind: "letter";
  insurer: Insurer;
  /** ISO date, or "" for a letter that carries no date (the renderer then prints none). */
  date: string;
  member: Member;
  re: { claim_number: string; provider: string; service: string; service_date: string; billed: string };
  title: string;
  paragraphs: string[];
  appeal: { heading: string; text: string; external: string };
  signature: string;
};

type EobLine = Record<"service" | "billed" | "allowed" | "plan_paid" | "copay" | "deductible" | "coinsurance" | "not_covered" | "remark", string>;

export type EobSource = {
  kind: "eob";
  insurer: Insurer;
  date: string;
  member: Member;
  claim: { claim_number: string; provider: string; facility: string; service_date: string; service: string };
  lines: EobLine[];
  totals: { billed: string; allowed: string; plan_paid: string; you_may_owe: string };
  remarks: string[];
  appeal: string;
};

export type Source = LetterSource | EobSource;

/**
 * The traps a case was built to exercise. Each names the field it is aimed at, so the report
 * can say "the model handles X" rather than only "accuracy went up".
 */
export const TRAPS = {
  boilerplate_expedited: "urgency_signals",
  urgent_case: "urgency_signals",
  vague_owed: "amounts.patient_responsibility",
  no_letter_date: "letter_date",
  deadline_as_date: "stated_appeal_deadline",
  short_deadline: "stated_appeal_deadline",
  no_deadline: "stated_appeal_deadline",
  medicare_advantage: "program_signals",
  medicaid_managed_care: "program_signals",
  emergency_visit: "emergency_signals",
  insurer_out_of_state: "state_hint",
  us_date_format: "service_dates",
} as const;
export type Trap = keyof typeof TRAPS;

export type StatedDeadlineTruth = { kind: "days"; days: number } | { kind: "date"; date: string } | null;

/** What a perfect extraction would return. `null` means "not in the document". */
export type Expected = {
  document_type: "denial_letter" | "eob";
  program_signals: "commercial" | "medicare" | "medicaid";
  insurer_name: string;
  member_id: string;
  claim_number: string;
  letter_date: string | null;
  provider_name: string;
  /** The service as written, plus the CPT code a correct reading must keep. */
  service: { text: string; cpt: string };
  service_dates: string[];
  denial_category: DenialCategory;
  denial_codes: string[];
  amounts: { billed: number | null; allowed: number | null; plan_paid: number | null; patient_responsibility: number | null };
  network_status: "in_network" | "out_of_network" | "unknown";
  emergency_signals: boolean;
  urgency_signals: boolean;
  stated_appeal_deadline: StatedDeadlineTruth;
  state_hint: string;
};

export type Truth = { id: string; kind: Source["kind"]; category: DenialCategory; traps: Trap[]; expected: Expected };
