/**
 * Round trip with Adaption Labs (Adaptive Data) to give the eval set more varied wording.
 *
 *   pnpm eval:adaption export
 *       writes eval/adaption/blocks.csv and blocks.jsonl: one row per block of prose, with the
 *       facts it must keep. Upload either file to Adaptive Data and ask it to rewrite the `text`
 *       column (brief in eval/README.md).
 *
 *   pnpm eval:adaption import <file.csv|file.jsonl> [--column rewritten]
 *       reads the rewritten file, keeps only rewrites that preserved every fact and added none,
 *       and writes the adapted cases to eval/cases-adapted/ with the SAME ground truth.
 *       Then: pnpm gen:samples eval/cases-adapted && pnpm eval:run --cases eval/cases-adapted
 *
 * Rejected rows are listed with the reason; a case is adapted if at least one block passed.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { factsIn, parseCsv, pickRewriteColumn, toCsv, validateRewrite } from "./adapt-lib";
import type { Source, Truth } from "./types";

const CASES = path.resolve("eval/cases");
const OUT = path.resolve("eval/adaption");
const ADAPTED = path.resolve("eval/cases-adapted");

type Block = { id: string; block: string; text: string; must_keep: string };

/** The prose blocks of a document: the parts whose wording varies between real insurers. */
function blocksOf(source: Source): [string, string][] {
  if (source.kind === "letter") {
    return [
      ...source.paragraphs.map((p, i) => [`paragraphs.${i}`, p] as [string, string]),
      ["appeal.text", source.appeal.text],
      ["appeal.external", source.appeal.external],
    ];
  }
  return [...source.remarks.map((r, i) => [`remarks.${i}`, r] as [string, string]), ["appeal", source.appeal]];
}

function setBlock(source: Source, block: string, text: string) {
  const [key, idx] = block.split(".");
  if (source.kind === "letter") {
    if (key === "paragraphs") source.paragraphs[Number(idx)] = text;
    else if (key === "appeal") source.appeal[idx as "text" | "external"] = text;
  } else if (key === "remarks") source.remarks[Number(idx)] = text;
  else if (key === "appeal") source.appeal = text;
}

const namesOf = (s: Source) => [s.insurer.name, s.kind === "letter" ? s.re.provider : s.claim.provider.replace(/\s*\(.*\)$/, "")];

async function loadCases() {
  const ids = (await readdir(CASES)).filter((f) => f.endsWith(".truth.json")).map((f) => f.replace(".truth.json", "")).sort();
  return Promise.all(
    ids.map(async (id) => ({
      id,
      source: JSON.parse(await readFile(path.join(CASES, `${id}.source.json`), "utf8")) as Source,
      truth: JSON.parse(await readFile(path.join(CASES, `${id}.truth.json`), "utf8")) as Truth,
    })),
  );
}

async function exportBlocks() {
  const cases = await loadCases();
  const rows: Block[] = cases.flatMap(({ id, source }) =>
    blocksOf(source).map(([block, text]) => ({ id, block, text, must_keep: factsIn(text, namesOf(source)).join(" | ") })),
  );
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "blocks.csv"), toCsv(rows, ["id", "block", "text", "must_keep"]));
  await writeFile(path.join(OUT, "blocks.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`exported ${rows.length} blocks from ${cases.length} cases to ${path.relative(process.cwd(), OUT)}/blocks.{csv,jsonl}`);
}

async function importBlocks(file: string, column?: string) {
  if (!file || !existsSync(file)) throw new Error("usage: pnpm eval:adaption import <file.csv|file.jsonl> [--column name]");
  const raw = await readFile(file, "utf8");
  const rows: Record<string, string>[] = file.endsWith(".jsonl") ? raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : parseCsv(raw);
  if (!rows.length) throw new Error("the file has no rows");

  // Adaptive Data names its output column itself; accept the usual names or --column.
  const col = pickRewriteColumn(Object.keys(rows[0]), column);
  if (!col) throw new Error(`no rewritten-text column found; columns are: ${Object.keys(rows[0]).join(", ")} — pass --column`);

  const all = await loadCases();
  const cases = new Map(all.map((c) => [c.id, c]));
  // If the export dropped the id and block columns, rows are matched on their original text.
  const byText = new Map<string, { id: string; block: string }[]>();
  for (const c of all)
    for (const [block, text] of blocksOf(c.source)) byText.set(text.trim(), [...(byText.get(text.trim()) ?? []), { id: c.id, block }]);

  const adapted = new Map<string, { source: Source; truth: Truth; blocks: number }>();
  const rejected: string[] = [];
  // A boilerplate paragraph shared by several cases matches several rows: rewrite each block once.
  const done = new Set<string>();

  for (const row of rows) {
    const matched = row.id && row.block ? [{ id: row.id, block: row.block }] : (byText.get((row.text ?? "").trim()) ?? []);
    const targets = matched.filter((t) => !done.has(`${t.id} ${t.block}`));
    if (matched.length && !targets.length) continue; // a repeat of a block already rewritten
    if (!targets.length) {
      rejected.push(`${row.id ?? "?"} ${row.block ?? "?"}: no id/block and no matching original text`);
      continue;
    }
    for (const { id, block } of targets) {
      const c = cases.get(id);
      if (!c) {
        rejected.push(`${id} ${block}: unknown case id`);
        continue;
      }
      const original = blocksOf(c.source).find(([b]) => b === block)?.[1];
      if (original === undefined) {
        rejected.push(`${id} ${block}: unknown block`);
        continue;
      }
      const check = validateRewrite(original, row[col] ?? "", namesOf(c.source));
      if (!check.ok) {
        rejected.push(`${id} ${block}: ${check.reason}`);
        continue;
      }
      const entry = adapted.get(c.id) ?? { source: structuredClone(c.source), truth: c.truth, blocks: 0 };
      setBlock(entry.source, block, row[col].trim());
      done.add(`${id} ${block}`);
      entry.blocks++;
      adapted.set(c.id, entry);
    }
  }

  await mkdir(ADAPTED, { recursive: true });
  for (const [id, { source, truth }] of adapted) {
    await writeFile(path.join(ADAPTED, `${id}.source.json`), JSON.stringify(source, null, 2) + "\n");
    await writeFile(path.join(ADAPTED, `${id}.truth.json`), JSON.stringify(truth, null, 2) + "\n");
  }
  const accepted = [...adapted.values()].reduce((n, a) => n + a.blocks, 0);
  console.log(`accepted ${accepted}/${rows.length} rewritten blocks · ${adapted.size} cases adapted into ${path.relative(process.cwd(), ADAPTED)}`);
  if (rejected.length) {
    await writeFile(path.join(OUT, "rejected.txt"), rejected.join("\n") + "\n");
    console.log(`rejected ${rejected.length} (reasons in eval/adaption/rejected.txt), for example:`);
    for (const r of rejected.slice(0, 5)) console.log(`  ${r}`);
  }
}

const [cmd, file] = process.argv.slice(2);
const colIdx = process.argv.indexOf("--column");
(cmd === "export" ? exportBlocks() : cmd === "import" ? importBlocks(file, colIdx > -1 ? process.argv[colIdx + 1] : undefined) : Promise.reject(new Error("usage: pnpm eval:adaption export | import <file>"))).catch(
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
