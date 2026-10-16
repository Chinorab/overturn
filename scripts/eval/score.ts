/**
 * Scores one extraction against the ground truth it was generated with, and rolls many case
 * scores up into a report. Pure functions: no I/O, no model, so the scoring itself is tested.
 *
 * Four verdicts per field, because they are four different failures for the person using
 * Overturn:
 *   correct        the value matches (or both say "not in the document")
 *   miss           the document says it, the extraction left it empty
 *   hallucination  the document does not say it, the extraction filled it anyway
 *   wrong          both filled, but with different values
 * A hallucination is the one the product is designed to prevent, so it is reported apart.
 */
import type { Extraction } from "@/lib/schemas/extraction";
import { TRAPS, type Expected, type Source, type Trap, type Truth } from "./types";

export type Verdict = "correct" | "miss" | "hallucination" | "wrong";
export type FieldResult = { field: string; verdict: Verdict; expected: unknown; got: unknown };
export type Grounding = { checked: number; grounded: number; ungrounded: { field: string; quote: string }[] };
export type CaseResult = { id: string; category: string; kind: string; traps: Trap[]; fields: FieldResult[]; grounding: Grounding };

/* ------------------------------------------------------------------ comparison helpers */

const normText = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Same entity, written a little differently: one normalized form contains the other. */
export function sameText(a: string, b: string): boolean {
  const x = normText(a);
  const y = normText(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
}

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

function judge<E, G>(expected: E | null, got: G | null, same: (e: E, g: G) => boolean): Verdict {
  if (expected === null) return got === null ? "correct" : "hallucination";
  if (got === null) return "miss";
  return same(expected, got) ? "correct" : "wrong";
}

/** For a flag, "false" and "not mentioned" are the same answer. */
function judgeFlag(expected: boolean, got: boolean | null): Verdict {
  if (!expected) return got === true ? "hallucination" : "correct";
  return got === true ? "correct" : "miss";
}

/** For a choice with an explicit "unknown", reading "unknown" when the truth is unknown is right. */
function judgeChoice(expected: string, got: string | null, unknown: string[]): Verdict {
  const gotUnknown = got === null || unknown.includes(got);
  if (unknown.includes(expected)) return gotUnknown ? "correct" : "hallucination";
  if (gotUnknown) return "miss";
  return got === expected ? "correct" : "wrong";
}

/* ------------------------------------------------------------------ one case */

export function scoreCase(truth: Truth, ex: Extraction, source: Source): CaseResult {
  const e: Expected = truth.expected;
  const r: FieldResult[] = [];
  const add = (field: string, verdict: Verdict, expected: unknown, got: unknown) => r.push({ field, verdict, expected, got });

  add("document_type", judge(e.document_type, ex.document_type.value, (a, b) => a === b), e.document_type, ex.document_type.value);

  // A commercial plan read as Medicare or Medicaid sends the person to the wrong door: "wrong".
  // Reading it as "unknown" is harmless: the app only stops on an explicit government program.
  const prog = ex.program_signals.value;
  const progVerdict: Verdict =
    e.program_signals === "commercial"
      ? prog === null || prog === "commercial" || prog === "unknown"
        ? "correct"
        : "wrong"
      : judgeChoice(e.program_signals, prog, ["unknown", "commercial"]);
  add("program_signals", progVerdict, e.program_signals, prog);

  add("insurer_name", judge(e.insurer_name, ex.insurer_name.value, sameText), e.insurer_name, ex.insurer_name.value);
  add("member_id", judge(e.member_id, ex.member_id.value, (a, b) => normCode(a) === normCode(b)), e.member_id, ex.member_id.value);
  add("claim_number", judge(e.claim_number, ex.claim_number.value, (a, b) => normCode(a) === normCode(b)), e.claim_number, ex.claim_number.value);
  add("letter_date", judge(e.letter_date, ex.letter_date.value, (a, b) => a === b), e.letter_date, ex.letter_date.value);
  add("provider_name", judge(e.provider_name, ex.provider_name.value, sameText), e.provider_name, ex.provider_name.value);
  add(
    "service_description",
    judge(e.service, ex.service_description.value, (a, b) => b.includes(a.cpt) || sameText(a.text, b)),
    e.service.text,
    ex.service_description.value,
  );
  add(
    "service_dates",
    judge(e.service_dates, ex.service_dates.value && ex.service_dates.value.length ? ex.service_dates.value : null, (a, b) => a.every((d) => b.includes(d))),
    e.service_dates,
    ex.service_dates.value,
  );
  add("denial_category", judge(e.denial_category, ex.denial_category.value, (a, b) => a === b), e.denial_category, ex.denial_category.value);
  add(
    "denial_codes",
    judge(e.denial_codes, ex.denial_codes.value && ex.denial_codes.value.length ? ex.denial_codes.value : null, (a, b) => {
      const got = new Set(b.map(normCode));
      return a.every((c) => got.has(normCode(c)));
    }),
    e.denial_codes,
    ex.denial_codes.value,
  );
  for (const k of ["billed", "allowed", "plan_paid", "patient_responsibility"] as const) {
    add(`amounts.${k}`, judge(e.amounts[k], ex.amounts[k].value, sameMoney), e.amounts[k], ex.amounts[k].value);
  }
  add("network_status", judgeChoice(e.network_status, ex.network_status.value, ["unknown"]), e.network_status, ex.network_status.value);
  add("emergency_signals", judgeFlag(e.emergency_signals, ex.emergency_signals.value), e.emergency_signals, ex.emergency_signals.value);
  add("urgency_signals", judgeFlag(e.urgency_signals, ex.urgency_signals.value), e.urgency_signals, ex.urgency_signals.value);
  add(
    "stated_appeal_deadline",
    judge(e.stated_appeal_deadline, ex.stated_appeal_deadline.value, (a, b) =>
      a.kind === "days" ? b.kind === "days" && b.days === a.days : b.kind === "date" && b.date === a.date,
    ),
    e.stated_appeal_deadline,
    ex.stated_appeal_deadline.value,
  );
  add("state_hint", judge(e.state_hint, ex.state_hint.value, (a, b) => a === b), e.state_hint, ex.state_hint.value);

  return { id: truth.id, category: truth.category, kind: truth.kind, traps: truth.traps, fields: r, grounding: groundQuotes(ex, source) };
}

/* ------------------------------------------------------------------ receipts */

/** Words the PDF renderer prints around the source fields, so quotes that include them still count. */
const RENDER_WORDS =
  "member id group claim ref provider service date dates of amount billed dear sincerely statement number facility services " +
  "allowed plan paid copay deductible coinsurance not covered remarks totals you may owe the remark codes appeal rights this is a bill explanation benefits";

/** Every word a reader could see on the page: source strings, dates in both spellings, labels. */
export function pageWords(source: Source): Set<string> {
  const parts: string[] = [RENDER_WORDS];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      parts.push(v);
      for (const iso of v.match(/\d{4}-\d{2}-\d{2}/g) ?? []) {
        const [y, m, d] = iso.split("-").map(Number);
        parts.push(new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }));
      }
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(source);
  return new Set(parts.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * Overturn's promise is that every fact shows the sentence it came from. A quote counts as
 * grounded when at least 80% of its words appear on the page; the model may trim or join.
 */
export function groundQuotes(ex: Extraction, source: Source): Grounding {
  const words = pageWords(source);
  const out: Grounding = { checked: 0, grounded: 0, ungrounded: [] };
  const visit = (name: string, f: { value: unknown; quote: string | null }) => {
    if (f.value === null || !f.quote) return;
    const q = f.quote.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!q.length) return;
    out.checked++;
    if (q.filter((w) => words.has(w)).length / q.length >= 0.8) out.grounded++;
    else out.ungrounded.push({ field: name, quote: f.quote });
  };
  for (const [k, v] of Object.entries(ex)) {
    if (k === "amounts") for (const [ak, av] of Object.entries(v as Extraction["amounts"])) visit(`amounts.${ak}`, av);
    else visit(k, v as { value: unknown; quote: string | null });
  }
  return out;
}

/* ------------------------------------------------------------------ the report */

type Tally = Record<Verdict, number>;
const empty = (): Tally => ({ correct: 0, miss: 0, hallucination: 0, wrong: 0 });
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");

export type Summary = {
  cases: number;
  fieldsScored: number;
  overall: Tally;
  byField: Record<string, Tally>;
  byCategory: Record<string, Tally>;
  byKind: Record<string, Tally>;
  /** For each trap: how often the field it targets was read correctly in the cases that carry it. */
  byTrap: Record<string, { field: string; correct: number; total: number }>;
  grounding: { checked: number; grounded: number };
};

export function summarize(results: CaseResult[]): Summary {
  const s: Summary = { cases: results.length, fieldsScored: 0, overall: empty(), byField: {}, byCategory: {}, byKind: {}, byTrap: {}, grounding: { checked: 0, grounded: 0 } };
  for (const c of results) {
    for (const f of c.fields) {
      s.fieldsScored++;
      s.overall[f.verdict]++;
      (s.byField[f.field] ??= empty())[f.verdict]++;
      (s.byCategory[c.category] ??= empty())[f.verdict]++;
      (s.byKind[c.kind] ??= empty())[f.verdict]++;
    }
    for (const t of c.traps) {
      const target = TRAPS[t];
      const f = c.fields.find((x) => x.field === target);
      if (!f) continue;
      const row = (s.byTrap[t] ??= { field: target, correct: 0, total: 0 });
      row.total++;
      if (f.verdict === "correct") row.correct++;
    }
    s.grounding.checked += c.grounding.checked;
    s.grounding.grounded += c.grounding.grounded;
  }
  return s;
}

export function renderMarkdown(s: Summary, meta: { model: string; date: string; cost: string; failures: CaseResult[] }): string {
  const acc = (t: Tally) => pct(t.correct, t.correct + t.miss + t.hallucination + t.wrong);
  const lines: string[] = [];
  lines.push(`# Extraction eval — ${meta.model}`, "");
  lines.push(`${meta.date} · ${s.cases} documents · ${s.fieldsScored} fields scored · cost ${meta.cost}`, "");
  lines.push("| | Rate |", "|---|---|");
  lines.push(`| Field accuracy | **${acc(s.overall)}** |`);
  lines.push(`| Hallucinations (filled a field the document does not contain) | ${s.overall.hallucination} (${pct(s.overall.hallucination, s.fieldsScored)}) |`);
  lines.push(`| Misses (left empty a field the document does contain) | ${s.overall.miss} (${pct(s.overall.miss, s.fieldsScored)}) |`);
  lines.push(`| Wrong values | ${s.overall.wrong} (${pct(s.overall.wrong, s.fieldsScored)}) |`);
  lines.push(`| Quotes found on the page ("every fact has a receipt") | ${pct(s.grounding.grounded, s.grounding.checked)} of ${s.grounding.checked} |`, "");

  lines.push("## By field", "", "| Field | Accuracy | Miss | Hallucination | Wrong |", "|---|---|---|---|---|");
  for (const [f, t] of Object.entries(s.byField)) lines.push(`| ${f} | ${acc(t)} | ${t.miss} | ${t.hallucination} | ${t.wrong} |`);

  lines.push("", "## Traps", "", "Each trap is planted to catch one specific misreading.", "", "| Trap | Targets | Read correctly |", "|---|---|---|");
  for (const [t, row] of Object.entries(s.byTrap).sort()) lines.push(`| ${t} | ${row.field} | ${row.correct}/${row.total} |`);

  lines.push("", "## By denial category", "", "| Category | Accuracy |", "|---|---|");
  for (const [c, t] of Object.entries(s.byCategory).sort()) lines.push(`| ${c} | ${acc(t)} |`);
  lines.push("", "## By document type", "", "| Type | Accuracy |", "|---|---|");
  for (const [k, t] of Object.entries(s.byKind)) lines.push(`| ${k} | ${acc(t)} |`);

  const bad = meta.failures.flatMap((c) => c.fields.filter((f) => f.verdict !== "correct").map((f) => ({ id: c.id, ...f })));
  if (bad.length) {
    lines.push("", "## Every error", "", "| Case | Field | Verdict | Expected | Got |", "|---|---|---|---|---|");
    const cell = (v: unknown) => (v === null ? "—" : `\`${JSON.stringify(v).replace(/\|/g, "\\|")}\``);
    for (const b of bad) lines.push(`| ${b.id} | ${b.field} | ${b.verdict} | ${cell(b.expected)} | ${cell(b.got)} |`);
  }
  return lines.join("\n") + "\n";
}
