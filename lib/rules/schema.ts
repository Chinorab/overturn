import { z } from "zod";
import { DenialCategory, DocumentType, ISODate, PlanSource, USStateCode } from "@/lib/schemas/core";

export const Jurisdiction = z.enum(["federal", "nsa", "CA", "NY", "TX"]);
export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const RuleCategory = z.enum(["deadline", "protection", "right", "process"]);
export type RuleCategory = z.infer<typeof RuleCategory>;

export const DeadlineAnchor = z.enum(["letter_date", "final_internal_denial_date", "service_date"]);
export type DeadlineAnchor = z.infer<typeof DeadlineAnchor>;

export const AppliesIf = z
  .object({
    state: z.array(USStateCode).optional(),
    plan_source: z.array(PlanSource).optional(),
    /** "any" = regardless; "yes"/"no" = only that funding type (shown with caveat when unknown). */
    self_funded: z.enum(["yes", "no", "any"]).optional(),
    denial_category: z.array(DenialCategory).optional(),
    emergency: z.boolean().optional(),
    urgent: z.boolean().optional(),
    document_type: z.array(DocumentType).optional(),
  })
  .strict();
export type AppliesIf = z.infer<typeof AppliesIf>;

export const Deadline = z
  .object({
    anchor: DeadlineAnchor,
    amount: z.number().positive(),
    unit: z.enum(["days", "months", "hours"]),
    who: z.enum(["consumer", "insurer"]),
  })
  .strict();
export type Deadline = z.infer<typeof Deadline>;

/**
 * One protection, right, or deadline. No rule ships without a primary source and a
 * verification date — the schema test enforces it.
 */
export const Rule = z
  .object({
    id: z.string().regex(/^[a-z]+(\.[a-z0-9_]+)+$/, "id like fed.internal_appeal.filing_window"),
    jurisdiction: Jurisdiction,
    category: RuleCategory,
    title: z.string().min(4),
    summary: z.string().min(20),
    legal_ref: z.string().min(3),
    source_url: z.string().url().startsWith("https://"),
    last_verified: ISODate,
    applies_if: AppliesIf,
    deadline: Deadline.optional(),
    priority: z.number().int().min(0),
    why_template: z.string().min(10),
    caveat: z.string().optional(),
  })
  .strict();
export type Rule = z.infer<typeof Rule>;

export const RuleFile = z.array(Rule);

export const HelpResource = z
  .object({
    id: z.string(),
    scope: z.union([z.literal("federal"), USStateCode]),
    name: z.string(),
    kind: z.enum(["CAP", "regulator", "ombudsman", "helpdesk"]),
    phone: z.string().optional(),
    url: z.string().url().startsWith("https://"),
    what_they_do: z.string().min(10),
  })
  .strict();
export type HelpResource = z.infer<typeof HelpResource>;
export const HelpResourceFile = z.array(HelpResource);
