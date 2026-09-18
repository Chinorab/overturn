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
export type Field<T> = { value: T | null; confidence: number; quote: string | null; page: number | null };

const fieldWith =
  <C extends z.ZodType<number>>(confidence: C) =>
  <T extends z.ZodTypeAny>(inner: T) =>
    z.object({
      value: inner.nullable(),
      confidence: confidence.describe("0 to 1: how sure you are, given the document"),
      quote: z.string().nullable().describe("Verbatim snippet the value was read from"),
      page: z.number().int().nullable().describe("1-based page the snippet is on"),
    });

const statedDeadlineWith = <D extends z.ZodType<string>>(date: D) =>
  z.union([
    z.object({ kind: z.literal("date"), date }),
    z.object({ kind: z.literal("days"), days: z.number().int() }),
  ]);

/**
 * Two flavours of the same shape: `Extraction` is strict (regex dates, 0..1 confidence)
 * and is what the app trusts; `ExtractionModelSchema` drops the JSON-schema keywords that
 * structured outputs do not accept (pattern, minimum, maximum) and is what the model fills.
 */
const buildExtraction = <D extends z.ZodType<string>, C extends z.ZodType<number>>(date: D, confidence: C) => {
  const field = fieldWith(confidence);
  return z.object({
    document_type: field(DocumentType),
    program_signals: field(ProgramSignal),
    insurer_name: field(z.string()),
    member_id: field(z.string()),
    claim_number: field(z.string()),
    letter_date: field(date),
    provider_name: field(z.string()),
    service_description: field(z.string()),
    service_dates: field(z.array(date)),
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
    stated_appeal_deadline: field(statedDeadlineWith(date)),
    stated_appeal_address: field(z.string()),
    stated_appeal_instructions: field(z.string()),
    state_hint: field(USStateCode),
  });
};

export const field = fieldWith(z.number().min(0).max(1));

export const StatedDeadline = statedDeadlineWith(ISODate);
export type StatedDeadline = z.infer<typeof StatedDeadline>;

export const Extraction = buildExtraction(ISODate, z.number().min(0).max(1));
export type Extraction = z.infer<typeof Extraction>;

export const ExtractionModelSchema = buildExtraction(
  z.string().describe("Calendar date as YYYY-MM-DD"),
  z.number(),
);

/** Fields that must be confirmed before rights can be computed. */
export const REQUIRED_FOR_RIGHTS = ["letter_date", "denial_category", "state_hint", "document_type"] as const;
export const CONFIDENCE_AUTO_ACCEPT = 0.75;

export const Explanation = z.object({
  summary: z.string(),
  grade_level: z.number(),
  terms: z.array(z.object({ term: z.string(), definition: z.string() })),
});
export type Explanation = z.infer<typeof Explanation>;

/** What the model returns for the explanation; grade level is computed by us, not the model. */
export const ExplanationModelSchema = z.object({
  summary: z.string().describe("Plain-English explanation, 120 words or fewer, grade 8 reading level"),
  terms: z.array(z.object({ term: z.string(), definition: z.string() })).describe("Jargon used in the summary, each with a one-sentence definition"),
});
