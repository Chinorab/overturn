import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getProvider, isModelDown, resetProviderCache } from "@/lib/ai/provider";
import { extractDocument } from "@/lib/ai/extract";
import { explainExtraction } from "@/lib/ai/explain";
import { draftLetter } from "@/lib/ai/draft";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { DEFAULT_SAMPLE_ANSWERS, SAMPLES as CATALOGUE } from "@/lib/samples";
import { buildSituation } from "@/lib/situation";
import { Explanation, Extraction, fromModel, toModel } from "@/lib/schemas/extraction";
import { LetterDraft } from "@/lib/schemas/letter";

const DIR = join(process.cwd(), "data", "samples");
const SAMPLES = readdirSync(DIR)
  .filter((f) => f.endsWith(".extraction.json"))
  .map((f) => f.replace(".extraction.json", ""))
  .sort();

const load = (id: string, kind: string) => JSON.parse(readFileSync(join(DIR, `${id}.${kind}.json`), "utf8"));

beforeAll(() => {
  process.env.OVERTURN_LLM_PROVIDER = "fake";
  resetProviderCache();
});

describe("extraction model round trip", () => {
  // The fake answers in the model's shape, so `toModel` has to be a faithful inverse of
  // `fromModel` — otherwise every test below would be measuring the fake, not the pipeline.
  it.each(SAMPLES)("%s survives toModel -> fromModel unchanged", (id) => {
    const original = Extraction.parse(load(id, "extraction"));
    const back = Extraction.parse(fromModel(toModel(original)));
    expect(back).toEqual(original);
  });
});

describe("provider selection", () => {
  it("builds the fake when OVERTURN_LLM_PROVIDER says so", async () => {
    expect((await getProvider()).id).toBe("fake");
  });

  it("rejects an unknown provider by name", async () => {
    process.env.OVERTURN_LLM_PROVIDER = "gpt-9";
    resetProviderCache();
    await expect(getProvider()).rejects.toThrow(/not one of/);
    process.env.OVERTURN_LLM_PROVIDER = "fake";
    resetProviderCache();
  });

  it("defaults to anthropic, and a missing key reads as model_unavailable", async () => {
    delete process.env.OVERTURN_LLM_PROVIDER;
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    resetProviderCache();
    const provider = await getProvider();
    expect(provider.id).toBe("anthropic");
    // The route turns this into a 503 with a sentence the person can act on, so the class the
    // provider throws matters as much as the message.
    await expect(
      provider.structured({ task: "write", system: "", user: "", schema: z.object({}), schemaName: "Letter", maxTokens: 10 }),
    ).rejects.toSatisfy((e: unknown) => isModelDown(e));

    if (key) process.env.ANTHROPIC_API_KEY = key;
    process.env.OVERTURN_LLM_PROVIDER = "fake";
    resetProviderCache();
  });

  it("does not implement chatWithTools", async () => {
    const provider = await getProvider();
    await expect(provider.chatWithTools({ system: "", messages: [], tools: [], maxTokens: 10 })).rejects.toThrow();
  });
});

describe("the pipeline runs end to end on the fake", () => {
  it("extractDocument returns the golden extraction", async () => {
    process.env.OVERTURN_FAKE_SAMPLE = "02-prior-auth-ca";
    resetProviderCache();
    const { extraction } = await extractDocument({ kind: "pdf", base64: "" });
    expect(extraction).toEqual(Extraction.parse(load("02-prior-auth-ca", "extraction")));
  });

  it("explainExtraction ships the golden summary without needing a rewrite", async () => {
    const ex = Extraction.parse(load("02-prior-auth-ca", "extraction"));
    const { explanation, regenerated } = await explainExtraction(ex);
    const golden = Explanation.parse(load("02-prior-auth-ca", "explain"));
    expect(explanation.summary).toBe(golden.summary);
    // The readability gate is real code running on real text: a golden summary must clear it.
    expect(regenerated).toBe(false);
  });

  it("draftLetter passes the citation guard on every sample", async () => {
    for (const sample of CATALOGUE.filter((s) => s.category !== "unsupported")) {
      const id = sample.id;
      const extraction = Extraction.parse(load(id, "extraction"));
      // Same construction as the golden letter test, so a difference here is the provider's.
      const situation = buildSituation(extraction, { ...DEFAULT_SAMPLE_ANSWERS[id], state: sample.state }, "2026-09-18")!;
      const rights = computeRights(situation, ALL_RULES, HELP_RESOURCES);
      const { draft } = await draftLetter(situation, rights);
      const golden = LetterDraft.parse(load(id, "letter"));

      expect(draft.sections.map((s) => s.id)).toEqual(golden.sections.map((s) => s.id));
      // What the fake proves is that the guard downstream of the provider still runs: it strips
      // citations no computed right backs, and reports what it could not fix.
      expect(draft.guard_report.unknown_citations).toEqual([]);
      expect(draft.guard_report.prescriptive_hits).toEqual([]);
      expect(draft.guard_report.regenerated).toBe(false);
    }
  });
});
