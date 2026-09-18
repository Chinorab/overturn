/**
 * Runs extraction + explanation once per sample and commits the outputs so the demo
 * never depends on the API. Costs money: prints token usage per sample.
 * Run: pnpm precompute [sample-id ...]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const dir = path.join(process.cwd(), "data", "samples");

async function main() {
  const { extractDocument } = await import("../lib/ai/extract");
  const { explainExtraction } = await import("../lib/ai/explain");
  const { SAMPLES } = await import("../lib/samples");

  const explainOnly = process.argv.includes("--explain-only");
  const lettersOnly = process.argv.includes("--letters");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const targets = SAMPLES.filter((s) => s.category !== "unsupported" && (only.length === 0 || only.includes(s.id)));
  let totalIn = 0;
  let totalOut = 0;

  if (lettersOnly) {
    const { draftLetter } = await import("../lib/ai/draft");
    const { computeRights } = await import("../lib/rules/engine");
    const { ALL_RULES, HELP_RESOURCES } = await import("../lib/rules/load");
    const { DEFAULT_SAMPLE_ANSWERS } = await import("../lib/samples");
    const { buildSituation } = await import("../lib/situation");
    for (const s of targets) {
      const extraction = JSON.parse(await readFile(path.join(dir, `${s.id}.extraction.json`), "utf8"));
      const situation = buildSituation(extraction, { ...DEFAULT_SAMPLE_ANSWERS[s.id], state: s.state });
      if (!situation) throw new Error(`${s.id}: no letter date`);
      const rights = computeRights(situation, ALL_RULES, HELP_RESOURCES);
      const t0 = Date.now();
      const { draft, usage } = await draftLetter(situation, rights);
      await writeFile(path.join(dir, `${s.id}.letter.json`), JSON.stringify(draft, null, 2) + "
");
      totalIn += usage.input;
      totalOut += usage.output;
      const words = draft.sections.map((x) => x.text).join(" ").split(/\s+/).length;
      console.log(`${s.id}: ${Date.now() - t0}ms  in=${usage.input} out=${usage.output}  words=${words} placeholders=${draft.placeholders.length} cites=${draft.cited_rule_ids.length}${draft.guard_report.regenerated ? " (regenerated)" : ""} hits=${draft.guard_report.prescriptive_hits.join("|")}`);
    }
    report(totalIn, totalOut);
    return;
  }

  for (const s of targets) {
    const pdf = await readFile(path.join(dir, `${s.id}.pdf`));
    const t0 = Date.now();
    const { extraction, usage } = explainOnly
      ? { extraction: JSON.parse(await readFile(path.join(dir, `${s.id}.extraction.json`), "utf8")), usage: { input: 0, output: 0 } }
      : await extractDocument({ kind: "pdf", base64: pdf.toString("base64") });
    const { explanation, usage: u2, regenerated } = await explainExtraction(extraction);
    await writeFile(path.join(dir, `${s.id}.extraction.json`), JSON.stringify(extraction, null, 2) + "\n");
    await writeFile(path.join(dir, `${s.id}.explain.json`), JSON.stringify(explanation, null, 2) + "\n");
    totalIn += usage.input + u2.input;
    totalOut += usage.output + u2.output;
    console.log(
      `${s.id}: ${Date.now() - t0}ms  extract in=${usage.input} out=${usage.output}  explain in=${u2.input} out=${u2.output}${regenerated ? " (explanation regenerated)" : ""}  grade=${explanation.grade_level}`,
    );
  }
  report(totalIn, totalOut);
}

// Opus 5 list price: $5 / M input, $25 / M output.
function report(totalIn: number, totalOut: number) {
  const cost = (totalIn / 1e6) * 5 + (totalOut / 1e6) * 25;
  console.log(`total in=${totalIn} out=${totalOut}  ≈ $${cost.toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
