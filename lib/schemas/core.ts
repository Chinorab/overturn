import { z } from "zod";

/** ISO calendar date, e.g. "2026-09-18". Time of day is never relevant here. */
export const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export type ISODate = z.infer<typeof ISODate>;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
export const USStateCode = z.enum(US_STATES);
export type USStateCode = z.infer<typeof USStateCode>;

/** States with a rules overlay in v1. Everyone else gets the federal baseline. */
export const SUPPORTED_STATES = ["CA", "NY", "TX"] as const satisfies readonly USStateCode[];
export type SupportedState = (typeof SUPPORTED_STATES)[number];
export const isSupportedState = (s: string): s is SupportedState =>
  (SUPPORTED_STATES as readonly string[]).includes(s);

export const DenialCategory = z.enum([
  "medical_necessity",
  "prior_auth",
  "out_of_network",
  "not_covered",
  "coding_admin",
  "experimental",
  "timely_filing",
  "duplicate",
  "other",
]);
export type DenialCategory = z.infer<typeof DenialCategory>;

export const DENIAL_CATEGORY_LABEL: Record<DenialCategory, string> = {
  medical_necessity: "Not medically necessary",
  prior_auth: "Prior authorization missing",
  out_of_network: "Out of network",
  not_covered: "Not a covered benefit",
  coding_admin: "Coding or administrative error",
  experimental: "Experimental or investigational",
  timely_filing: "Filed too late",
  duplicate: "Duplicate claim",
  other: "Other reason",
};

export const PlanSource = z.enum(["employer", "marketplace", "direct", "other"]);
export type PlanSource = z.infer<typeof PlanSource>;

export const YesNoUnknown = z.enum(["yes", "no", "unknown"]);
export type YesNoUnknown = z.infer<typeof YesNoUnknown>;

export const DocumentType = z.enum(["denial_letter", "eob", "other"]);
export type DocumentType = z.infer<typeof DocumentType>;

export const ProgramSignal = z.enum(["commercial", "medicare", "medicaid", "tricare", "unknown"]);
export type ProgramSignal = z.infer<typeof ProgramSignal>;

export const NetworkStatus = z.enum(["in_network", "out_of_network", "unknown"]);
export type NetworkStatus = z.infer<typeof NetworkStatus>;
