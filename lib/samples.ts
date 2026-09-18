import type { DenialCategory, USStateCode } from "@/lib/schemas/core";

/**
 * The bundled sample documents. All synthetic: fictional insurers, people, and
 * addresses; watermarked "SAMPLE". Their model outputs are pre-computed and committed
 * (data/samples/<id>.extraction.json, .explain.json) so the demo never depends on the
 * API being up and never costs a jury member anything.
 */
export type Sample = {
  id: string;
  title: string;
  blurb: string;
  document_type: "denial_letter" | "eob";
  state: USStateCode;
  category: DenialCategory | "unsupported";
  pages: number;
};

export const SAMPLES: Sample[] = [
  {
    id: "01-medical-necessity-ny",
    title: "MRI denied as “not medically necessary”",
    blurb: "A two-page letter from an employer plan in New York. The most common kind of denial.",
    document_type: "denial_letter",
    state: "NY",
    category: "medical_necessity",
    pages: 2,
  },
  {
    id: "02-prior-auth-ca",
    title: "Surgery denied: no prior authorization",
    blurb: "A California HMO letter about an already-scheduled procedure.",
    document_type: "denial_letter",
    state: "CA",
    category: "prior_auth",
    pages: 2,
  },
  {
    id: "03-oon-emergency-tx-eob",
    title: "ER visit billed out of network",
    blurb: "A Texas Explanation of Benefits for an emergency visit, with a large “you may owe”.",
    document_type: "eob",
    state: "TX",
    category: "out_of_network",
    pages: 1,
  },
  {
    id: "04-not-covered-fl",
    title: "Physical therapy: “not a covered benefit”",
    blurb: "A Florida Marketplace plan letter. Shows the federal-only fallback for states we do not cover yet.",
    document_type: "denial_letter",
    state: "FL",
    category: "not_covered",
    pages: 1,
  },
  {
    id: "05-coding-error-ny-eob",
    title: "Lab work denied for a coding error",
    blurb: "A New York EOB where the remark code points at a billing mistake, not a coverage decision.",
    document_type: "eob",
    state: "NY",
    category: "coding_admin",
    pages: 1,
  },
  {
    id: "06-medicare-unsupported",
    title: "A Medicare Advantage denial",
    blurb: "Shows what happens when a document is outside Overturn's scope: an honest stop, with the right link.",
    document_type: "denial_letter",
    state: "TX",
    category: "unsupported",
    pages: 1,
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id);
