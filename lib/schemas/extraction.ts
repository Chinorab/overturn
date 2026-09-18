import { z } from "zod";
import {
  DenialCategory,
  DocumentType,
  ISODate,
  NetworkStatus,
  ProgramSignal,
  USStateCode,
} from "./core";

/**
 * Every extracted value is wrapped so the UI can show where it came from and
 * how sure the model was. `value: null` is the only way to say "not in the document".
 */
export const field = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.number().min(0).max(1),
    quote: z.string().nullable().describe("Verbatim snippet the value was read from"),
    page: z.number().int().positive().nullable(),
  });

export type Field<T> = { value: T | null; confidence: number; quote: string | null; page: number | null };

export const StatedDeadline = z.union([
  z.object({ kind: z.literal("date"), date: ISODate }),
  z.object({ kind: z.literal("days"), days: z.number().int().positive() }),
]);
export type StatedDeadline = z.infer<typeof StatedDeadline>;

export const Extraction = z.object({
  document_type: field(DocumentType),
  program_signals: field(ProgramSignal),
  insurer_name: field(z.string()),
  member_id: field(z.string()),
  claim_number: field(z.string()),
  letter_date: field(ISODate),
  provider_name: field(z.string()),
  service_description: field(z.string()),
  service_dates: field(z.array(ISODate)),
  denial_category: field(DenialCategory),
  denial_reason_quote: field(z.string()),
  denial_codes: field(z.array(z.string())),
  amounts: z.object({
    billed: field(z.number()),
    allowed: field(z.number()),
    plan_paid: field(z.number()),
    patient_responsibility: field(z.number()),
  }),
  network_status: field(NetworkStatus),
  emergency_signals: field(z.boolean()),
  urgency_signals: field(z.boolean()),
  stated_appeal_deadline: field(StatedDeadline),
  stated_appeal_address: field(z.string()),
  stated_appeal_instructions: field(z.string()),
  state_hint: field(USStateCode),
});
export type Extraction = z.infer<typeof Extraction>;

/** Fields that must be confirmed before rights can be computed. */
export const REQUIRED_FOR_RIGHTS = ["letter_date", "denial_category", "state_hint", "document_type"] as const;
export const CONFIDENCE_AUTO_ACCEPT = 0.75;

export const Explanation = z.object({
  summary: z.string(),
  grade_level: z.number(),
  terms: z.array(z.object({ term: z.string(), definition: z.string() })),
});
export type Explanation = z.infer<typeof Explanation>;
