import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { computeRights } from "@/lib/rules/engine";
import { buildSituation } from "@/lib/situation";
import type { Answers } from "@/lib/session";
import { documentReadback, answersReadback, fieldReadback, spokenService } from "@/lib/voice/readback";
import { spokenRights, sourceName, CHUNK_MAX_WORDS } from "@/lib/voice/rights-speech";
import { spokenMoney, spokenDate, numberToWords, maskEmail, countWords, firstSentences } from "@/lib/voice/spoken";
import { checkTurn } from "@/lib/voice/turn-check";

const TODAY = "2026-10-21";
const ex = (id: string) => Extraction.parse(JSON.parse(readFileSync(`data/samples/${id}.extraction.json`, "utf8")));
const SAMPLES: [string, Answers][] = [
  ["01-medical-necessity-ny", { state: "NY", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }],
  ["02-prior-auth-ca", { state: "CA", plan_source: "marketplace", self_funded: "no", emergency: "no", urgent: "no" }],
  ["03-oon-emergency-tx-eob", { state: "TX", plan_source: "employer", self_funded: "unknown", emergency: "yes", urgent: "no" }],
  ["04-not-covered-fl", { state: "FL", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }],
  ["05-coding-error-ny-eob", { state: "NY", plan_source: "employer", self_funded: "no", emergency: "no", urgent: "no" }],
  ["07-experimental-ca-photo", { state: "CA", plan_source: "direct", self_funded: "no", emergency: "no", urgent: "yes" }],
];

describe("formats", () => {
  it("money in words", () => {
    expect(spokenMoney(18750)).toBe("eighteen thousand seven hundred fifty dollars");
    expect(spokenMoney(45.6)).toBe("forty-five dollars and sixty cents");
    expect(spokenMoney(3478.4)).toBe("three thousand four hundred seventy-eight dollars");
    expect(numberToWords(1_250_000)).toBe("one million two hundred fifty thousand");
  });
  it("dates with ordinal, year only when not this year", () => {
    expect(spokenDate("2026-09-04", TODAY)).toBe("September 4th");
    expect(spokenDate("2027-03-10", TODAY)).toBe("March 10th, 2027");
    expect(spokenDate("2026-10-21", TODAY)).toBe("October 21st");
  });
  it("masks emails for text and speech", () =>
    expect(maskEmail("walter.demo@gmail.com")).toEqual({ text: "w•••@gmail.com", spoken: "w-dot-gmail-dot-com" }));
  it("keeps U.S. inside one sentence", () =>
    expect(firstSentences("Goes to the U.S. Department of Labor. Next.", 1)).toBe("Goes to the U.S. Department of Labor."));
  it("speaks services without codes, acronyms intact", () => {
    expect(spokenService("Laparoscopic cholecystectomy (CPT 47562)")).toBe("a laparoscopic cholecystectomy");
    expect(spokenService("MRI of the left knee without contrast (CPT 73721)")).toBe("an MRI of the left knee without contrast");
    expect(spokenService("Emergency department visit, level 4 (CPT 99284); CT abdomen (CPT 74176)")).toBe("an emergency department visit, level 4 and more");
  });
});

describe("read-backs", () => {
  for (const [id] of SAMPLES) it(`${id}: ≤ 40 words, ends with the question, names the insurer`, () => {
    const e = ex(id);
    const rb = documentReadback(e, TODAY);
    expect(countWords(rb.spoken)).toBeLessThanOrEqual(40);
    expect(rb.spoken.endsWith("Is that right?")).toBe(true);
    expect(rb.spoken).toContain(e.insurer_name.value!);
    expect(checkTurn(rb.spoken, { kind: "readback_only" }).ok).toBe(true);
  });
  it("answers read-back for the no-document path", () => {
    const rb = answersReadback({ state: "Texas", plan_source: "employer", denial_category: "prior_auth", approxDate: "2026-10-07" }, TODAY);
    expect(rb.spoken).toBe("So far: Texas, coverage through your employer, denied because prior authorization wasn't obtained, letter around October 7th. Is that right?");
  });
  it("single-field re-read", () =>
    expect(fieldReadback("date", "September 2nd, 2026")).toBe("The date is September 2nd, 2026. The rest stays as I read it. Better?"));
});

describe("rights speech", () => {
  for (const [id, answers] of SAMPLES) it(`${id}: chunks ≤ ${CHUNK_MAX_WORDS} words, one question, every protection sourced`, () => {
    const s = buildSituation(ex(id), answers, TODAY)!;
    const r = computeRights(s, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY });
    expect(sp.chunks.length).toBeGreaterThan(0);
    for (const c of sp.chunks) {
      expect(countWords(c)).toBeLessThanOrEqual(CHUNK_MAX_WORDS);
      expect((c.match(/\?/g) ?? []).length).toBe(1);
      expect(checkTurn(c, { kind: "rights_chunk" }).violations).toEqual([]);
    }
    for (const p of sp.protections) {
      expect(p.spoken).toContain(p.sourceName);
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    if (sp.firstDeadline) {
      expect(sp.firstDeadline.spoken).toMatch(/\d+ days/);
      expect(sp.firstDeadline.spoken).toContain(sp.firstDeadline.sourceName);
      expect(sp.chunks[0]).toContain(sp.firstDeadline.spoken);
    }
    expect(sp.chunks.at(-1)).toMatch(/That's everything that applies\. Shall I draft the appeal letter\?$/);
    // same engine, same facts → same rights: spoken ids are exactly the applied rule ids
    const spokenIds = new Set([...(sp.firstDeadline ? [sp.firstDeadline.ruleId] : []), ...sp.protections.map((p) => p.id)]);
    expect(spokenIds).toEqual(new Set(r.rules.map((a) => a.rule.id)));
  });
  it("sample 02: March 10th 2027, 140 days, ACA rules, CA grievance first, no NSA", () => {
    const r = computeRights(buildSituation(ex("02-prior-auth-ca"), SAMPLES[1][1], TODAY)!, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY });
    expect(sp.firstDeadline).toMatchObject({ date: "2027-03-10", daysRemaining: 140, ruleId: "fed.internal_appeal.filing_window", sourceName: "the federal ACA appeal rules" });
    expect(sp.chunks[0]).toContain("Department of Managed Health Care");
    expect(sp.protections.map((p) => p.id)).not.toContain("nsa.emergency.no_balance_billing");
  });
  it("approximate path says so and uses 'around' / 'about'", () => {
    const e = Extraction.parse({ ...ex("02-prior-auth-ca"),
      letter_date: { value: "2026-10-07", confidence: 0.5, quote: null, page: null },
      stated_appeal_deadline: { value: null, confidence: 0, quote: null, page: null } });
    const r = computeRights(buildSituation(e, { state: "TX", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }, TODAY)!, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY, approximate: true });
    expect(sp.chunks[0]).toMatch(/^Because the date is approximate/);
    expect(sp.firstDeadline?.spoken).toMatch(/around April 5th, 2027 — about 166 days/);
  });
  it("every rule in the dataset gets a named source", () => {
    for (const rule of ALL_RULES) expect(sourceName(rule)).not.toMatch(/^(federal|nsa|CA|NY|TX) law$/);
  });
});
