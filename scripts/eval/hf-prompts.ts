/**
 * Writes the prompts the trained reader is tested on, in the exact training format:
 * the 60 eval cases (unseen by the model, same generator) and the 7 hand-written samples
 * in data/samples (wording the model has never seen).
 *
 *   pnpm eval:hf-prompts     # eval/autoscientist/job-input/prompts.jsonl
 *
 * scripts/eval/hf_eval_launch.py sends this file to a Hugging Face GPU job, and
 * scripts/eval/score-generations.ts scores what comes back.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { INSTRUCTION, renderText } from "./train-set";
import type { Source } from "./types";

async function sources(dir: string) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".source.json")).sort();
  return Promise.all(
    files.map(async (f) => ({ id: f.replace(".source.json", ""), source: JSON.parse(await readFile(path.join(dir, f), "utf8")) as Source })),
  );
}

async function main() {
  const out = path.resolve("eval/autoscientist/job-input");
  await mkdir(out, { recursive: true });
  const rows = [
    ...(await sources(path.resolve("eval/cases"))).map((c) => ({ ...c, set: "eval" })),
    ...(await sources(path.resolve("data/samples"))).map((c) => ({ ...c, set: "sample" })),
  ].map(({ id, set, source }) => ({ id, set, prompt: `${INSTRUCTION}\n\n<document>\n${renderText(source)}\n</document>` }));
  await writeFile(path.join(out, "prompts.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`wrote ${rows.length} prompts (${rows.filter((r) => r.set === "eval").length} eval, ${rows.filter((r) => r.set === "sample").length} samples) to ${path.relative(process.cwd(), out)}/prompts.jsonl`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
