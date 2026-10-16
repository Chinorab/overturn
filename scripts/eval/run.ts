/**
 * Runs the real extraction step over the eval set and scores it against the ground truth.
 *
 *   pnpm eval:run                       # dry run: counts cases and prints the estimated cost
 *   pnpm eval:run --yes                 # spends: extracts every case not already cached
 *   pnpm eval:run --yes --limit 10      # spends on the first 10 only
 *   pnpm eval:run --only eval-001-...   # one or more ids, comma-separated
 *   pnpm eval:run --score-only          # rescore what is cached, no API call
 *
 * The model is whatever the app is configured with (OVERTURN_MODEL, default claude-opus-5):
 * set it in the environment to compare models; each model caches into its own folder.
 * Every model call costs money, so nothing is sent without --yes.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { renderMarkdown, scoreCase, summarize, type CaseResult } from "./score";
import type { Source, Truth } from "./types";

config({ path: ".env.local" });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(name);

/** USD per million tokens, input / output — from the Claude API price list (2026-10). */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-haiku-4-5": [1, 5],
};
/** Rough per-document estimate (one-page PDF + prompt in, evidence-heavy JSON out). The report uses real usage. */
const TYPICAL = { input: 4000, output: 1800 };

type Cached = { extraction: unknown; usage: { input: number; output: number }; ms: number };

async function main() {
  const casesDir = path.resolve(arg("--cases") ?? "eval/cases");
  const model = process.env.OVERTURN_MODEL ?? "claude-opus-5";
  const provider = process.env.OVERTURN_LLM_PROVIDER ?? "anthropic";
  const outDir = path.resolve(arg("--out") ?? path.join("eval", "results", `${provider}-${model}`));
  const only = arg("--only")?.split(",");
  const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;

  if (!existsSync(casesDir)) throw new Error(`no eval set at ${casesDir} — run: pnpm eval:generate`);
  let ids = (await readdir(casesDir)).filter((f) => f.endsWith(".truth.json")).map((f) => f.replace(".truth.json", "")).sort();
  if (only) ids = ids.filter((id) => only.includes(id));
  ids = ids.slice(0, limit);

  const cachedPath = (id: string) => path.join(outDir, `${id}.json`);
  const todo = ids.filter((id) => !existsSync(cachedPath(id)));
  const missingPdf = todo.filter((id) => !existsSync(path.join(casesDir, `${id}.pdf`)));
  if (missingPdf.length) throw new Error(`${missingPdf.length} cases have no PDF yet — run: pnpm gen:samples eval/cases`);

  const price = PRICES[model];
  const perDoc = price ? (TYPICAL.input * price[0] + TYPICAL.output * price[1]) / 1e6 : NaN;
  console.log(`model ${provider}/${model} · ${ids.length} cases · ${ids.length - todo.length} cached · ${todo.length} to extract`);
  if (todo.length) {
    console.log(price ? `estimated cost: ~$${(perDoc * todo.length).toFixed(2)} (~$${perDoc.toFixed(3)} per document)` : `no price on file for ${model}; cost unknown`);
  }

  if (todo.length && !flag("--score-only")) {
    if (!flag("--yes") && provider !== "fake") {
      console.log("\nDry run. Nothing was sent. Add --yes to run the extraction and spend the amount above.");
      return;
    }
    await mkdir(outDir, { recursive: true });
    const { extractDocument } = await import("../../lib/ai/extract");
    let done = 0;
    const queue = [...todo];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const pdf = await readFile(path.join(casesDir, `${id}.pdf`));
        const t0 = Date.now();
        try {
          const { extraction, usage } = await extractDocument({ kind: "pdf", base64: pdf.toString("base64") });
          const row: Cached = { extraction, usage, ms: Date.now() - t0 };
          await writeFile(cachedPath(id), JSON.stringify(row, null, 2) + "\n");
          console.log(`  ${++done}/${todo.length} ${id}  ${row.ms}ms  in=${usage.input} out=${usage.output}`);
        } catch (e) {
          // One bad case must not sink the run: it is reported and retried next time.
          console.log(`  ${++done}/${todo.length} ${id}  FAILED: ${(e as Error).message.slice(0, 160)}`);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  /* ---------------------------------------------------------------- score what we have */
  const results: CaseResult[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  for (const id of ids) {
    if (!existsSync(cachedPath(id))) continue;
    const cached = JSON.parse(await readFile(cachedPath(id), "utf8")) as Cached;
    const truth = JSON.parse(await readFile(path.join(casesDir, `${id}.truth.json`), "utf8")) as Truth;
    const source = JSON.parse(await readFile(path.join(casesDir, `${id}.source.json`), "utf8")) as Source;
    results.push(scoreCase(truth, cached.extraction as Parameters<typeof scoreCase>[1], source));
    tokensIn += cached.usage.input;
    tokensOut += cached.usage.output;
  }
  if (!results.length) {
    console.log("nothing scored yet");
    return;
  }

  const summary = summarize(results);
  const cost = price ? `$${((tokensIn * price[0] + tokensOut * price[1]) / 1e6).toFixed(3)}` : "unknown";
  const date = new Date().toISOString().slice(0, 10);
  const reportDir = path.resolve("eval", "reports");
  await mkdir(reportDir, { recursive: true });
  const base = path.join(reportDir, `${date}-${provider}-${model}`);
  await writeFile(`${base}.md`, renderMarkdown(summary, { model: `${provider}/${model}`, date, cost, failures: results }));
  await writeFile(`${base}.json`, JSON.stringify({ model, provider, date, cost, summary }, null, 2) + "\n");

  const o = summary.overall;
  const total = o.correct + o.miss + o.hallucination + o.wrong;
  console.log(`\nscored ${summary.cases} documents · accuracy ${((100 * o.correct) / total).toFixed(1)}% · hallucinations ${o.hallucination} · misses ${o.miss} · wrong ${o.wrong}`);
  console.log(`receipts on the page: ${summary.grounding.grounded}/${summary.grounding.checked} · cost ${cost}`);
  console.log(`report: ${path.relative(process.cwd(), base)}.md`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
