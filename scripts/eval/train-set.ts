/**
 * Builds a supervised training set for Adaption Labs' AutoScientist: document text in, the
 * extraction Overturn expects out. Same generator as the eval set, different seed, so the 60
 * eval cases stay unseen by the model trained on this.
 *
 *   pnpm eval:train-set                        # 1,200 rows into eval/autoscientist (seed 20261104)
 *   pnpm eval:train-set --count 2000 --seed 9
 *
 * Writes train.jsonl and train.csv with two columns, `prompt` and `completion`. The completion is
 * the model-facing JSON (`ExtractionModelSchema`), so a model trained on it can answer the same
 * call the app makes today. Labels come from the ground truth, never from a model, and every row
 * is checked before it is written: it parses back to a valid extraction, scores 100% against its
 * truth, and every evidence quote is a verbatim substring of the document text.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Extraction, fromModel, toModel, type ExtractionModel, type Field } from "@/lib/schemas/extraction";
import { toCsv } from "./adapt-lib";
import { generateCases } from "./generate";
import { scoreCase } from "./score";
import type { EobSource, LetterSource, Source, Truth } from "./types";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/* ------------------------------------------------------------------ the document as text */

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The words of the sample PDF, in reading order (scripts/gen-sample-pdfs.tsx lays them out),
 * minus the "synthetic document" watermark and footer: a real letter never has them, so the
 * model should not learn to expect them.
 */
export function renderText(s: Source): string {
  const head = [s.insurer.logo_text, s.insurer.name, s.insurer.address, `Member Services ${s.insurer.phone}`, ""];
  const foot = ["", "Page 1 of 1"];
  if (s.kind === "letter") {
    return [
      ...head,
      ...(s.date ? [longDate(s.date), ""] : []),
      s.member.name,
      ...s.member.address.split("\n"),
      "",
      `Member ID: ${s.member.member_id}`,
      `Group: ${s.member.group}`,
      `Claim / Ref #: ${s.re.claim_number}`,
      `Provider: ${s.re.provider}`,
      `Service: ${s.re.service}`,
      `Date(s) of service: ${s.re.service_date}`,
      ...(s.re.billed ? [`Amount billed: $${s.re.billed}`] : []),
      "",
      s.title,
      "",
      `Dear ${s.member.name.split(" ")[0]},`,
      "",
      ...s.paragraphs.flatMap((p) => [p, ""]),
      s.appeal.heading,
      s.appeal.text,
      "",
      s.appeal.external,
      "",
      "Sincerely,",
      ...s.signature.split("\n"),
      ...foot,
    ].join("\n");
  }
  const line = s.lines[0];
  return [
    ...head,
    "Explanation of Benefits",
    "THIS IS NOT A BILL",
    ...(s.date ? [`Statement date: ${longDate(s.date)}`] : []),
    `Claim number: ${s.claim.claim_number}`,
    `Member ID: ${s.member.member_id}`,
    `Group: ${s.member.group}`,
    "",
    s.member.name,
    ...s.member.address.split("\n"),
    "",
    `Provider: ${s.claim.provider}`,
    ...(s.claim.facility ? [`Facility: ${s.claim.facility}`] : []),
    `Date of service: ${s.claim.service_date}`,
    `Services: ${s.claim.service}`,
    "",
    "Service | Billed | Allowed | Plan paid | Copay | Deductible | Coinsurance | Not covered | Remarks",
    `${line.service} | $${line.billed} | $${line.allowed} | $${line.plan_paid} | $${line.copay} | $${line.deductible} | $${line.coinsurance} | $${line.not_covered} | ${line.remark}`,
    `Totals | $${s.totals.billed} | $${s.totals.allowed} | $${s.totals.plan_paid} | Amount you may owe the provider: $${s.totals.you_may_owe}`,
    "",
    "Remark codes",
    ...s.remarks,
    "",
    "Appeal rights",
    s.appeal,
    ...foot,
  ].join("\n");
}

/** What the trained model is asked; the same text must be sent at inference. */
export const INSTRUCTION = `Read this US health insurance document (a denial letter or an Explanation of Benefits) and return Overturn's extraction as JSON.
Report only what the document says. A field the document does not contain gets its empty value ("" / 0 / [] / "unknown" / "other") and no evidence entry. Every filled field gets exactly one evidence entry: a verbatim quote of up to 25 words, the page, and a confidence from 0 to 1. Dates are YYYY-MM-DD.`;

/* ------------------------------------------------------------------ the right answer, with receipts */

const firstWords = (s: string, n = 25) => s.split(" ").slice(0, n).join(" ");
const firstSentence = (s: string) => s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s;

/** The strict extraction a perfect reader returns for this document, quotes taken from `text`. */
function answerFor(source: Source, truth: Truth, text: string): Extraction {
  const e = truth.expected;
  const quote = (q: string) => {
    if (!text.includes(q)) throw new Error(`${truth.id}: quote not on the page: ${JSON.stringify(q)}`);
    return q;
  };
  const f = <T,>(value: T | null, q: string | null, confidence = 0.95): Field<T> =>
    value === null || q === null ? { value: null, confidence: 0, quote: null, page: null } : { value, confidence, quote: quote(q), page: 1 };

  const letter = source.kind === "letter" ? (source as LetterSource) : null;
  const eob = source.kind === "eob" ? (source as EobSource) : null;

  // The reason sentence as printed, then without the "Reason for denial:" label.
  const reasonLine = letter
    ? letter.paragraphs.find((p) => / Reason code: [A-Z]{2}-\d+\.$/.test(p))!
    : eob!.remarks[0];
  const reasonPrinted = letter ? reasonLine.replace(/ Reason code: [A-Z]{2}-\d+\.$/, "") : reasonLine.replace(/^[A-Z]{2}-\d+: /, "");
  const reason = reasonPrinted.replace(/^Reason for denial: /, "");

  const appealText = letter ? letter.appeal.text : eob!.appeal.replace(/^This is not a bill\. (This statement is for [^.]*\. )?/, "");
  const address = `${source.insurer.name}, Appeals Unit, ${source.insurer.address}`;
  const stateLine = source.member.address.split("\n")[1];
  const service = letter ? letter.re.service : eob!.claim.service;
  const serviceDateLine = letter ? `Date(s) of service: ${letter.re.service_date}` : `Date of service: ${eob!.claim.service_date}`;
  const providerLine = letter ? `Provider: ${letter.re.provider}` : `Provider: ${eob!.claim.provider}`;
  const totalsLine = eob ? `Totals | $${eob.totals.billed} | $${eob.totals.allowed} | $${eob.totals.plan_paid}` : "";

  const amount = (k: keyof typeof e.amounts): string | null => {
    if (e.amounts[k] === null) return null;
    if (eob) return k === "patient_responsibility" ? `Amount you may owe the provider: $${eob.totals.you_may_owe}` : totalsLine;
    if (k === "billed") return `Amount billed: $${letter!.re.billed}`;
    if (k === "plan_paid") return firstSentence(letter!.paragraphs.find((p) => p.startsWith("The plan paid"))!);
    return letter!.paragraphs.find((p) => p.startsWith("The plan paid"))!.split(". ")[1];
  };

  const d = e.stated_appeal_deadline;
  const deadlineQuote =
    d === null ? null : d.kind === "date" ? firstSentence(appealText) : firstWords(firstSentence(appealText).replace(/^You or your authorized representative may /, ""));
  const network =
    e.network_status === "unknown" ? null : eob ? providerLine : firstSentence(reasonPrinted);

  return Extraction.parse({
    document_type: f(e.document_type, letter ? letter.title : "Explanation of Benefits", 0.97),
    program_signals: f(e.program_signals, `Group: ${source.member.group}`, e.program_signals === "commercial" ? 0.7 : 0.95),
    insurer_name: f(e.insurer_name, e.insurer_name, 0.97),
    member_id: f(e.member_id, `Member ID: ${e.member_id}`, 0.97),
    claim_number: f(e.claim_number, letter ? `Claim / Ref #: ${e.claim_number}` : `Claim number: ${e.claim_number}`, 0.97),
    letter_date: f(e.letter_date, e.letter_date && (letter ? longDate(e.letter_date) : `Statement date: ${longDate(e.letter_date)}`), 0.96),
    provider_name: f(e.provider_name, providerLine, 0.96),
    service_description: f(service, service, 0.96),
    service_dates: f(e.service_dates, serviceDateLine, 0.96),
    denial_category: f(e.denial_category, firstWords(firstSentence(reasonPrinted)), 0.92),
    denial_reason_quote: f(reason, firstWords(reasonPrinted)),
    denial_codes: f(e.denial_codes, letter ? `Reason code: ${e.denial_codes[0]}.` : firstWords(reasonLine, 12)),
    amounts: {
      billed: f(e.amounts.billed, amount("billed")),
      allowed: f(e.amounts.allowed, amount("allowed")),
      plan_paid: f(e.amounts.plan_paid, amount("plan_paid")),
      patient_responsibility: f(e.amounts.patient_responsibility, amount("patient_responsibility")),
    },
    network_status: f(e.network_status === "unknown" ? null : e.network_status, network, 0.92),
    emergency_signals: f(e.emergency_signals ? true : null, e.emergency_signals ? service : null, 0.95),
    urgency_signals: f(
      e.urgency_signals ? true : null,
      e.urgency_signals ? letter!.paragraphs.find((p) => p.startsWith("Because you are currently receiving inpatient care"))! : null,
      0.93,
    ),
    stated_appeal_deadline: f(d, deadlineQuote),
    stated_appeal_address: f(address, address),
    stated_appeal_instructions: f(firstSentence(appealText), firstWords(firstSentence(appealText)), 0.93),
    state_hint: f(e.state_hint, stateLine),
  });
}

/* ------------------------------------------------------------------ main */

type Row = { id: string; prompt: string; completion: string };

/**
 * One training row, checked: the label survives the exact path the app uses on a model answer
 * (`fromModel` then the strict schema) and scores 100% against the case's truth.
 */
export function trainingRow(source: Source, truth: Truth): Row {
  const text = renderText(source);
  const completion: ExtractionModel = toModel(answerFor(source, truth, text));
  const back = Extraction.parse(fromModel(completion));
  const score = scoreCase(truth, back, source);
  const bad = score.fields.filter((x) => x.verdict !== "correct");
  if (bad.length) throw new Error(`${truth.id}: label does not match its truth: ${bad.map((b) => b.field).join(", ")}`);
  if (score.grounding.grounded !== score.grounding.checked) throw new Error(`${truth.id}: ungrounded quote ${JSON.stringify(score.grounding.ungrounded)}`);
  return { id: `train-${truth.id.slice(5)}`, prompt: `${INSTRUCTION}\n\n<document>\n${text}\n</document>`, completion: JSON.stringify(completion) };
}

async function main() {
  const count = Number(arg("--count") ?? 1200);
  const seed = Number(arg("--seed") ?? 20261104);
  const out = path.resolve(arg("--out") ?? "eval/autoscientist");
  if (seed === 20261016) throw new Error("that is the eval set's seed: training on it would leak the test into the model");

  // Anything the eval set contains must not appear in training, even by coincidence.
  const evalDir = path.resolve("eval/cases");
  const evalTexts = new Set<string>();
  const evalClaims = new Set<string>();
  for (const f of (await readdir(evalDir)).filter((x) => x.endsWith(".source.json"))) {
    const s = JSON.parse(await readFile(path.join(evalDir, f), "utf8")) as Source;
    evalTexts.add(renderText(s));
    evalClaims.add(s.kind === "letter" ? s.re.claim_number : s.claim.claim_number);
  }

  const rows: Row[] = [];
  let skipped = 0;
  const tally = new Map<string, number>();
  for (const { source, truth } of generateCases(count, seed)) {
    if (evalTexts.has(renderText(source)) || evalClaims.has(truth.expected.claim_number)) {
      skipped++;
      continue;
    }
    rows.push(trainingRow(source, truth));
    for (const t of [truth.kind, truth.category, ...truth.traps]) tally.set(t, (tally.get(t) ?? 0) + 1);
  }

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "train.jsonl"), rows.map((r) => JSON.stringify({ prompt: r.prompt, completion: r.completion })).join("\n") + "\n");
  await writeFile(path.join(out, "train.csv"), toCsv(rows, ["prompt", "completion"]));

  const chars = rows.map((r) => r.prompt.length + r.completion.length);
  const tokens = (n: number) => Math.round(n / 4);
  console.log(`wrote ${rows.length} rows to ${path.relative(process.cwd(), out)}/train.{jsonl,csv} (seed ${seed}${skipped ? `, ${skipped} skipped as too close to the eval set` : ""})`);
  console.log(`every row checked: valid extraction, 100% against its truth, every quote verbatim on the page`);
  console.log(`size per row: ~${tokens(chars.reduce((a, b) => a + b, 0) / rows.length)} tokens on average, ~${tokens(Math.max(...chars))} at most`);
  console.log("mix:", Object.fromEntries([...tally].sort()));
}

// Run as a script, not when a test imports `trainingRow`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
