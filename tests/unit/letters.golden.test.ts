import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findPrescriptive } from "@/lib/ai/guard";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { DEFAULT_SAMPLE_ANSWERS, SAMPLES } from "@/lib/samples";
import { Extraction } from "@/lib/schemas/extraction";
import { LetterDraft } from "@/lib/schemas/letter";
import { buildSituation } from "@/lib/situation";
import { fleschKincaidGrade } from "@/lib/readability";

/**
 * SC-008, offline: every cached sample letter validates, cites only rules the engine
 * produced for that sample's default answers, has visible placeholders for unknowns,
 * uses no advice language, and stays at grade 10 or below. No API call.
 */
const dir = path.join(process.cwd(), "data", "samples");
const ids = SAMPLES.filter((s) => s.category !== "unsupported").map((s) => s.id);

describe("cached sample letters", () => {
  it.each(ids)("%s is a valid, guarded letter", (id) => {
    const sample = SAMPLES.find((s) => s.id === id)!;
    const letter = LetterDraft.parse(JSON.parse(readFileSync(path.join(dir, `${id}.letter.json`), "utf8")));
    const extraction = Extraction.parse(JSON.parse(readFileSync(path.join(dir, `${id}.extraction.json`), "utf8")));
    const situation = buildSituation(extraction, { ...DEFAULT_SAMPLE_ANSWERS[id], state: sample.state }, "2026-09-18")!;
    const allowed = new Set(computeRights(situation, ALL_RULES, HELP_RESOURCES).rules.map((r) => r.rule.id));

    const text = letter.sections.map((s) => s.text).join("\n\n");
    for (const rid of letter.cited_rule_ids) expect(allowed.has(rid), `cites ${rid} which the engine did not produce`).toBe(true);
    expect(letter.cited_rule_ids.length).toBeGreaterThanOrEqual(5);
    expect(letter.guard_report.unknown_citations).toEqual([]);
    expect(findPrescriptive(text)).toEqual([]);
    expect(text).not.toMatch(/!/);
    expect(letter.placeholders.length).toBeGreaterThanOrEqual(5);
    expect(letter.placeholders).toContain("your full name");
    expect(letter.sections.map((s) => s.id)).toEqual(["header", "re", "intro", "facts", "argument", "requests", "closing"]);
    const words = text.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(300);
    expect(words).toBeLessThanOrEqual(800);
    const prose = letter.sections.filter((s) => ["intro", "facts", "argument"].includes(s.id)).map((s) => s.text.replace(/\[\[cite:[^\]]+\]\]/g, "").replace(/\[ADD:[^\]]+\]/g, "details")).join(" ");
    expect(fleschKincaidGrade(prose)).toBeLessThanOrEqual(12);
    expect(letter.checklist.length).toBeGreaterThanOrEqual(3);
    // Facts stay facts: identifiers from the document appear verbatim.
    if (extraction.claim_number.value) expect(text).toContain(extraction.claim_number.value);
    if (extraction.member_id.value) expect(text).toContain(extraction.member_id.value);
  });
});
