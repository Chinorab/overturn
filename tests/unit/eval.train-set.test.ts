import { describe, expect, it } from "vitest";
import { ExtractionModelSchema } from "@/lib/schemas/extraction";
import { generateCases } from "../../scripts/eval/generate";
import { renderText, trainingRow } from "../../scripts/eval/train-set";

// Two full rotations of the traps, so every kind of case gets built and checked.
const cases = generateCases(24, 7);

describe("AutoScientist training rows", () => {
  it("label every case so it scores 100% against its own truth", () => {
    for (const { source, truth } of cases) expect(() => trainingRow(source, truth)).not.toThrow();
  });

  it("answer in the exact JSON the app parses from a model", () => {
    for (const { source, truth } of cases) {
      const row = trainingRow(source, truth);
      expect(ExtractionModelSchema.safeParse(JSON.parse(row.completion)).success).toBe(true);
      expect(row.prompt).toContain(renderText(source));
    }
  });

  it("quote only words that are on the page", () => {
    for (const { source, truth } of cases) {
      const row = trainingRow(source, truth);
      for (const e of JSON.parse(row.completion).evidence) expect(row.prompt).toContain(e.quote);
    }
  });

  it("leave out what a real letter never prints", () => {
    expect(cases.some(({ source }) => renderText(source).includes("synthetic document"))).toBe(false);
  });
});
