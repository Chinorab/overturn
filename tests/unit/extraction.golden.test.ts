import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Extraction, Explanation } from "@/lib/schemas/extraction";
import { findPrescriptive } from "@/lib/ai/guard";
import { fleschKincaidGrade, wordCount } from "@/lib/readability";

/**
 * SC-002 / SC-005 / SC-008, offline: the committed model outputs for the samples must
 * match the facts in the synthetic sources, validate against the strict schema, never
 * invent a value that is absent, and read at grade 8 or below without advice language.
 * No API call happens here; re-run `pnpm precompute` to refresh the cached outputs.
 */
const dir = path.join(process.cwd(), "data", "samples");
const load = (id: string) => ({
  extraction: Extraction.parse(JSON.parse(readFileSync(path.join(dir, `${id}.extraction.json`), "utf8"))),
  explanation: Explanation.parse(JSON.parse(readFileSync(path.join(dir, `${id}.explain.json`), "utf8"))),
});

const GOLDEN = {
  "01-medical-necessity-ny": {
    document_type: "denial_letter", insurer_name: "Meridian Health Plan of New York", claim_number: "CLM-26-0917-55831",
    letter_date: "2026-09-08", denial_category: "medical_necessity", state_hint: "NY", billed: 2400,
    stated_days: 180, emergency: null, urgency: null, patient_responsibility: null,
  },
  "02-prior-auth-ca": {
    document_type: "denial_letter", insurer_name: "Pacific Crest Health Plan", claim_number: "AUTH-26-33107",
    letter_date: "2026-09-11", denial_category: "prior_auth", state_hint: "CA", billed: 18750,
    stated_days: 180, emergency: null, urgency: null, patient_responsibility: null,
  },
  "03-oon-emergency-tx-eob": {
    document_type: "eob", insurer_name: "Lone Star Benefit Solutions", claim_number: "EOB-26-88120-4",
    letter_date: "2026-09-05", denial_category: "out_of_network", state_hint: "TX", billed: 4800,
    stated_days: 180, emergency: true, urgency: null, patient_responsibility: 3478.4,
  },
  "04-not-covered-fl": {
    document_type: "denial_letter", insurer_name: "Sunbelt Community Health", claim_number: "CLM-26-0904-11907",
    letter_date: "2026-09-14", denial_category: "not_covered", state_hint: "FL", billed: 640,
    stated_days: 180, emergency: null, urgency: null, patient_responsibility: null,
  },
  "05-coding-error-ny-eob": {
    document_type: "eob", insurer_name: "Empire Harbor Health", claim_number: "EOB-26-51022-9",
    letter_date: "2026-09-02", denial_category: "coding_admin", state_hint: "NY", billed: 244,
    stated_days: 180, emergency: null, urgency: null, patient_responsibility: 244,
  },
} as const;

describe("cached sample extractions", () => {
  it.each(Object.keys(GOLDEN))("%s matches the source facts", (id) => {
    const g = GOLDEN[id as keyof typeof GOLDEN];
    const { extraction: e } = load(id);
    expect(e.document_type.value).toBe(g.document_type);
    expect(e.insurer_name.value).toBe(g.insurer_name);
    expect(e.claim_number.value).toBe(g.claim_number);
    expect(e.letter_date.value).toBe(g.letter_date);
    expect(e.denial_category.value).toBe(g.denial_category);
    expect(e.state_hint.value).toBe(g.state_hint);
    expect(e.amounts.billed.value).toBe(g.billed);
    expect(e.stated_appeal_deadline.value).toEqual({ kind: "days", days: g.stated_days });
    expect(e.emergency_signals.value).toBe(g.emergency);
    expect(e.urgency_signals.value).toBe(g.urgency);
    expect(e.amounts.patient_responsibility.value).toBe(g.patient_responsibility);
    expect(e.program_signals.value).toBe("commercial");
  });

  it.each(Object.keys(GOLDEN))("%s: every present value has a quote and a page", (id) => {
    const { extraction: e } = load(id);
    const fields = [
      ...Object.entries(e).filter(([k]) => k !== "amounts"),
      ...Object.entries(e.amounts).map(([k, v]) => [`amounts.${k}`, v] as const),
    ] as Array<[string, { value: unknown; quote: string | null; page: number | null; confidence: number }]>;
    for (const [name, f] of fields) {
      if (f.value === null) {
        expect(f.confidence, `${name} absent but confident`).toBe(0);
      } else {
        expect(f.quote, `${name} has no quote`).toBeTruthy();
        expect(f.page, `${name} has no page`).toBeGreaterThan(0);
        expect(f.confidence, `${name} present but confidence 0`).toBeGreaterThan(0);
      }
    }
  });
});

describe("cached sample explanations", () => {
  it.each(Object.keys(GOLDEN))("%s reads at grade 8 or below, 120 words or fewer, no advice", (id) => {
    const { explanation: x } = load(id);
    expect(fleschKincaidGrade(x.summary)).toBeLessThanOrEqual(8);
    expect(wordCount(x.summary)).toBeLessThanOrEqual(120);
    expect(findPrescriptive(x.summary)).toEqual([]);
    expect(x.summary).not.toMatch(/!/);
    expect(x.terms.length).toBeGreaterThan(0);
  });
});
