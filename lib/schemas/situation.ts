import { z } from "zod";
import { ISODate, PlanSource, USStateCode, YesNoUnknown } from "./core";
import { Extraction } from "./extraction";

/**
 * What the person told us, as opposed to what the document said. Lives here rather than in
 * `lib/session.tsx` because the MCP server needs it too and cannot import a browser React module.
 */
export type Answers = {
  state: USStateCode;
  plan_source: PlanSource;
  self_funded: YesNoUnknown;
  emergency: YesNoUnknown;
  urgent: "yes" | "no";
  final_internal_denial_date?: string;
};

/** Confirmed extraction + the user's answers. The only input the rules engine sees. */
export const Situation = z.object({
  extraction: Extraction,
  state: USStateCode,
  plan_source: PlanSource,
  self_funded: YesNoUnknown,
  emergency: YesNoUnknown,
  urgent: z.enum(["yes", "no"]),
  anchor_dates: z.object({
    letter_date: ISODate,
    final_internal_denial_date: ISODate.optional(),
  }),
  today: ISODate,
});
export type Situation = z.infer<typeof Situation>;
