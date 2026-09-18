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

/** The strict shape the app trusts: nullable values, regex dates, 0..1 confidence. */
export const Extraction = buildExtraction(ISODate, z.number().min(0).max(1));
export type Extraction = z.infer<typeof Extraction>;

/**
 * The model-facing shape. Structured outputs compile the schema to a grammar, which caps
 * both union count and overall size, so this is deliberately small: one flat object of
 * values (absence = sentinel: "" / 0 / [] / "unknown" / "other") plus one `evidence` list
 * carrying quote, page, and confidence per field. `fromModel()` rebuilds the strict shape.
 */
export const MODEL_FIELDS = [
  "document_type", "program_signals", "insurer_name", "member_id", "claim_number", "letter_date",
  "provider_name", "service_description", "service_dates", "denial_category", "denial_reason_quote",
  "denial_codes", "amount_billed", "amount_allowed", "amount_plan_paid", "amount_patient_responsibility",
  "network_status", "emergency_signals", "urgency_signals", "stated_appeal_deadline_days",
  "stated_appeal_deadline_date", "stated_appeal_address", "stated_appeal_instructions", "state_hint",
] as const;
export type ModelField = (typeof MODEL_FIELDS)[number];

export const ExtractionModelSchema = z.object({
  document_type: DocumentType,
  program_signals: ProgramSignal,
  insurer_name: z.string(),
  member_id: z.string(),
  claim_number: z.string(),
  letter_date: z.string().describe("YYYY-MM-DD or empty"),
  provider_name: z.string(),
  service_description: z.string(),
  service_dates: z.array(z.string()).describe("YYYY-MM-DD each"),
  denial_category: DenialCategory,
  denial_reason_quote: z.string(),
  denial_codes: z.array(z.string()),
  amount_billed: z.number(),
  amount_allowed: z.number(),
  amount_plan_paid: z.number(),
  amount_patient_responsibility: z.number(),
  network_status: NetworkStatus,
  emergency_signals: z.boolean(),
  urgency_signals: z.boolean(),
  stated_appeal_deadline_days: z.number().int(),
  stated_appeal_deadline_date: z.string().describe("YYYY-MM-DD or empty"),
  stated_appeal_address: z.string(),
  stated_appeal_instructions: z.string(),
  state_hint: z.string().describe("two-letter state code or empty"),
  evidence: z
    .array(
      z.object({
        field: z.enum(MODEL_FIELDS),
        quote: z.string().describe("verbatim words from the document, up to ~25"),
        page: z.number().int().describe("1-based page"),
        confidence: z.number().describe("0 to 1"),
      }),
    )
    .describe("One entry per field that was found in the document; omit fields that are absent"),
});
export type ExtractionModel = z.infer<typeof ExtractionModelSchema>;

/** Sentinels -> null; evidence -> quote/page/confidence; then the strict schema decides. */
export function fromModel(m: ExtractionModel): unknown {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const ev = new Map<ModelField, { quote: string; page: number; confidence: number }>();
  for (const e of m.evidence) if (!ev.has(e.field)) ev.set(e.field, e);

  const wrap = (field: ModelField, value: unknown) => {
    const e = ev.get(field);
    const absent = value === null || !e;
    return {
      value: absent ? null : value,
      confidence: absent || !e ? 0 : Math.min(1, Math.max(0, e.confidence)),
      quote: absent || !e || !e.quote ? null : e.quote,
      page: absent || !e || e.page < 1 ? null : e.page,
    };
  };
  const text = (f: ModelField, v: string) => wrap(f, v.trim() ? v.trim() : null);
  const date = (f: ModelField, v: string) => wrap(f, iso.test(v) ? v : null);
  const num = (f: ModelField, v: number) => wrap(f, v !== 0 || ev.has(f) ? v : null);
  const bool = (f: ModelField, v: boolean) => wrap(f, ev.has(f) ? v : null);
  const list = (f: ModelField, v: string[], keep: (x: string) => boolean = () => true) => {
    const arr = v.filter(keep);
    return wrap(f, arr.length ? arr : null);
  };
  const choice = (f: ModelField, v: string, unknowns: string[]) => wrap(f, unknowns.includes(v) && !ev.has(f) ? null : v);

  let deadline;
  if (iso.test(m.stated_appeal_deadline_date)) deadline = wrap("stated_appeal_deadline_date", { kind: "date", date: m.stated_appeal_deadline_date });
  else if (m.stated_appeal_deadline_days > 0) deadline = wrap("stated_appeal_deadline_days", { kind: "days", days: m.stated_appeal_deadline_days });
  else deadline = wrap("stated_appeal_deadline_days", null);

  const state = m.state_hint.trim().toUpperCase();
  return {
    document_type: choice("document_type", m.document_type, ["other"]),
    program_signals: choice("program_signals", m.program_signals, ["unknown"]),
    insurer_name: text("insurer_name", m.insurer_name),
    member_id: text("member_id", m.member_id),
    claim_number: text("claim_number", m.claim_number),
    letter_date: date("letter_date", m.letter_date),
    provider_name: text("provider_name", m.provider_name),
    service_description: text("service_description", m.service_description),
    service_dates: list("service_dates", m.service_dates, (x) => iso.test(x)),
    denial_category: choice("denial_category", m.denial_category, []),
    denial_reason_quote: text("denial_reason_quote", m.denial_reason_quote),
    denial_codes: list("denial_codes", m.denial_codes),
    amounts: {
      billed: num("amount_billed", m.amount_billed),
      allowed: num("amount_allowed", m.amount_allowed),
      plan_paid: num("amount_plan_paid", m.amount_plan_paid),
      patient_responsibility: num("amount_patient_responsibility", m.amount_patient_responsibility),
    },
    network_status: choice("network_status", m.network_status, ["unknown"]),
    emergency_signals: bool("emergency_signals", m.emergency_signals),
    urgency_signals: bool("urgency_signals", m.urgency_signals),
    stated_appeal_deadline: deadline,
    stated_appeal_address: text("stated_appeal_address", m.stated_appeal_address),
    stated_appeal_instructions: text("stated_appeal_instructions", m.stated_appeal_instructions),
    state_hint: wrap("state_hint", /^[A-Z]{2}$/.test(state) ? state : null),
  };
}

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
