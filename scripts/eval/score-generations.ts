/**
 * Scores what the Hugging Face job generated (scripts/eval/hf_eval_job.py), mode by mode.
 *
 *   pnpm eval:score-generations      # reads eval/autoscientist/job-output/generations.jsonl
 *
 * Eval cases are scored against their ground truth exactly like a Claude run (same verdicts,
 * same receipt check). Hand-written samples have no generated truth, so they are compared field
 * by field with the extraction Claude produced for them (data/samples/*.extraction.json).
 * An answer that is not valid extraction JSON counts as reading nothing.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Extraction, ExtractionModelSchema, fromModel, MODEL_FIELDS } from "@/lib/schemas/extraction";
import { renderMarkdown, sameText, scoreCase, summarize, type CaseResult, type Verdict } from "./score";
import type { Source, Truth } from "./types";

type Gen = { id: string; set: "eval" | "sample"; mode: string; text: string; seconds: number };

/* ------------------------------------------------------------------ lenient mode */

const LENIENT = process.argv.includes("--lenient");
const pick = (v: unknown, hints: [RegExp, string][], fallback: string) =>
  typeof v === "string" ? (hints.find(([re]) => re.test(v))?.[1] ?? fallback) : fallback;
const CATEGORY: [RegExp, string][] = [
  [/^(medical_necessity|prior_auth|out_of_network|not_covered|coding_admin|experimental|timely_filing|duplicate|other)$/, ""],
  [/auth|cert/i, "prior_auth"], [/network|particip/i, "out_of_network"], [/duplic/i, "duplicate"],
  [/experiment|investig|unproven/i, "experimental"], [/timel|filing|late/i, "timely_filing"],
  [/cod|bill|claim.?error|admin|missing/i, "coding_admin"], [/necess|criteria/i, "medical_necessity"],
  [/cover|exclu|benefit|limit/i, "not_covered"],
];

/**
 * --lenient: what the app could repair after the model answers, without reading the document
 * again: near-miss labels mapped to the right one ("prior_authorization" -> "prior_auth"),
 * missing keys given their empty value, evidence entries for unknown fields dropped. Values the
 * model read are never changed, so this separates "wrong vocabulary" from "wrong reading".
 */
function repair(j: Record<string, unknown>): Record<string, unknown> {
  const cat = j.denial_category;
  const fixed = pick(cat, CATEGORY, "other");
  const defaults = {
    insurer_name: "", member_id: "", claim_number: "", letter_date: "", provider_name: "", service_description: "",
    service_dates: [], denial_reason_quote: "", denial_codes: [], amount_billed: 0, amount_allowed: 0, amount_plan_paid: 0,
    amount_patient_responsibility: 0, emergency_signals: false, urgency_signals: false, stated_appeal_deadline_days: 0,
    stated_appeal_deadline_date: "", stated_appeal_address: "", stated_appeal_instructions: "", state_hint: "",
  };
  const out: Record<string, unknown> = {
    ...defaults,
    ...j,
    denial_category: fixed === "" ? cat : fixed,
    document_type: pick(j.document_type, [[/eob|explanation/i, "eob"], [/denial|adverse|notice|letter/i, "denial_letter"]], "other"),
    program_signals: pick(j.program_signals, [[/medicare/i, "medicare"], [/medicaid|chip/i, "medicaid"], [/tricare|champva|\bva\b/i, "tricare"], [/commercial|employer|marketplace|private|group/i, "commercial"]], "unknown"),
    network_status: pick(j.network_status, [[/out|non/i, "out_of_network"], [/in.?network|particip/i, "in_network"]], "unknown"),
  };
  const ev = Array.isArray(j.evidence) ? (j.evidence as Record<string, unknown>[]) : [];
  out.evidence = ev
    .map((e) => (e.field === "stated_appeal_deadline" ? { ...e, field: out.stated_appeal_deadline_date ? "stated_appeal_deadline_date" : "stated_appeal_deadline_days" } : e))
    .filter((e) => (MODEL_FIELDS as readonly string[]).includes(String(e.field)));
  return out;
}

/** The JSON object in a model answer, if there is one that the app would accept. */
function parse(text: string): Extraction | null {
  const body = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const raw = JSON.parse(body.slice(start, end + 1));
    const model = ExtractionModelSchema.safeParse(LENIENT ? repair(raw) : raw);
    if (!model.success) return null;
    const strict = Extraction.safeParse(fromModel(model.data));
    return strict.success ? strict.data : null;
  } catch {
    return null;
  }
}

/** Reading nothing: every field absent. */
function empty(): Extraction {
  const none = { value: null, confidence: 0, quote: null, page: null };
  const keys = Object.keys(Extraction.shape) as (keyof Extraction)[];
  const out = Object.fromEntries(keys.map((k) => [k, none])) as Record<string, unknown>;
  out.amounts = { billed: none, allowed: none, plan_paid: none, patient_responsibility: none };
  return out as Extraction;
}

/* ------------------------------------------------------------------ samples vs Claude's reading */

const SAMPLE_FIELDS: [string, (x: Extraction) => unknown][] = [
  ["document_type", (x) => x.document_type.value],
  ["program_signals", (x) => (x.program_signals.value === "unknown" ? null : x.program_signals.value)],
  ["insurer_name", (x) => x.insurer_name.value],
  ["member_id", (x) => x.member_id.value],
  ["claim_number", (x) => x.claim_number.value],
  ["letter_date", (x) => x.letter_date.value],
  ["provider_name", (x) => x.provider_name.value],
  ["service_dates", (x) => x.service_dates.value],
  ["denial_category", (x) => x.denial_category.value],
  ["denial_codes", (x) => x.denial_codes.value],
  ["amounts.billed", (x) => x.amounts.billed.value],
  ["amounts.allowed", (x) => x.amounts.allowed.value],
  ["amounts.plan_paid", (x) => x.amounts.plan_paid.value],
  ["amounts.patient_responsibility", (x) => x.amounts.patient_responsibility.value],
  ["network_status", (x) => (x.network_status.value === "unknown" ? null : x.network_status.value)],
  ["emergency_signals", (x) => x.emergency_signals.value || null],
  ["urgency_signals", (x) => x.urgency_signals.value || null],
  ["stated_appeal_deadline", (x) => x.stated_appeal_deadline.value],
  ["state_hint", (x) => x.state_hint.value],
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.005;
  if (typeof a === "string" && typeof b === "string") return a === b || sameText(a, b) || norm(a) === norm(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v) => b.some((w) => same(v, w)));
  return JSON.stringify(a) === JSON.stringify(b);
}
function versus(reference: Extraction, got: Extraction): { field: string; verdict: Verdict }[] {
  return SAMPLE_FIELDS.map(([field, get]) => {
    const r = get(reference);
    const g = get(got);
    const absent = (v: unknown) => v === null || (Array.isArray(v) && v.length === 0);
    const verdict: Verdict = absent(r) ? (absent(g) ? "correct" : "hallucination") : absent(g) ? "miss" : same(r, g) ? "correct" : "wrong";
    return { field, verdict };
  });
}

/* ------------------------------------------------------------------ main */

async function main() {
  const file = path.resolve("eval/autoscientist/job-output/generations.jsonl");
  if (!existsSync(file)) throw new Error(`${file} not found: run the Hugging Face job first`);
  const gens = (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Gen);
  const modes = [...new Set(gens.map((g) => g.mode))];
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# AutoScientist reader (Qwen3.5-9B + LoRA) — ${date}${LENIENT ? " — lenient parsing" : ""}`, ""];
  lines.push("Text of each document in, extraction JSON out, greedy decoding, on a Hugging Face L40S job.", "");

  for (const mode of modes) {
    const mine = gens.filter((g) => g.mode === mode);
    let valid = 0;
    const evalResults: CaseResult[] = [];
    for (const g of mine.filter((x) => x.set === "eval")) {
      const truth = JSON.parse(await readFile(path.resolve("eval/cases", `${g.id}.truth.json`), "utf8")) as Truth;
      const source = JSON.parse(await readFile(path.resolve("eval/cases", `${g.id}.source.json`), "utf8")) as Source;
      const got = parse(g.text);
      if (got) valid++;
      evalResults.push(scoreCase(truth, got ?? empty(), source));
    }
    const sampleRows: string[] = [];
    let sampleCorrect = 0;
    let sampleTotal = 0;
    for (const g of mine.filter((x) => x.set === "sample")) {
      const got = parse(g.text);
      if (got) valid++;
      const ref = path.resolve("data/samples", `${g.id}.extraction.json`);
      if (!existsSync(ref)) {
        // The Medicare sample has no Claude reading: the only right answer is to flag the program.
        const program = got?.program_signals.value ?? "nothing";
        sampleRows.push(`| ${g.id} | program read as **${program}** (Overturn stops on Medicare) |`);
        continue;
      }
      const v = versus(Extraction.parse(JSON.parse(await readFile(ref, "utf8"))), got ?? empty());
      const ok = v.filter((x) => x.verdict === "correct").length;
      sampleCorrect += ok;
      sampleTotal += v.length;
      const off = v.filter((x) => x.verdict !== "correct").map((x) => `${x.field} (${x.verdict})`);
      sampleRows.push(`| ${g.id} | ${ok}/${v.length}${off.length ? ` · ${off.join(", ")}` : ""} |`);
    }

    const s = summarize(evalResults);
    const o = s.overall;
    const total = o.correct + o.miss + o.hallucination + o.wrong;
    const secs = mine.reduce((a, g) => a + g.seconds, 0) / mine.length;
    console.log(
      `${mode.padEnd(11)} valid JSON ${valid}/${mine.length} · eval ${((100 * o.correct) / total).toFixed(1)}% (hallucinations ${o.hallucination}, misses ${o.miss}, wrong ${o.wrong}) · samples ${sampleCorrect}/${sampleTotal} fields agree with Claude · ~${secs.toFixed(1)}s/doc`,
    );

    lines.push(`## Mode \`${mode}\``, "", `Valid extraction JSON: ${valid}/${mine.length}. About ${secs.toFixed(1)} s per document (batched).`, "");
    lines.push(...renderMarkdown(s, { model: `Qwen3.5-9B AutoScientist (${mode})`, date, cost: "see the job's bill", failures: evalResults }).split("\n").slice(2));
    lines.push("", "### Hand-written samples, against Claude's reading", "", "| Sample | Fields that agree |", "|---|---|", ...sampleRows, "");
  }

  const reportDir = path.resolve("eval/reports");
  await mkdir(reportDir, { recursive: true });
  const report = path.join(reportDir, `${date}-autoscientist-qwen3.5-9b${LENIENT ? "-lenient" : ""}.md`);
  await writeFile(report, lines.join("\n") + "\n");
  console.log(`report: ${path.relative(process.cwd(), report)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
