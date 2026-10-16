/**
 * Pure helpers for the Adaption Labs round trip: which facts a block of prose carries, and
 * whether a rewritten block still carries exactly those facts and no new ones.
 *
 * The ground truth of a case never changes when its wording does, so a rewrite is accepted
 * only if it keeps every fact verbatim and adds none. Anything else would silently make the
 * truth wrong, which is worse than having no rewrite at all.
 */

const MONEY = /\$[\d,]+\.\d{2}/g;
const LONG_DATE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g;
const NUM_DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/g;
const CODE = /\b(?:CO|PR|OA|PI)-\d+\b/g;
const DAYS = /\b\d+ days\b/g;
const PHONE = /\b1-\d{3}-\d{3}-\d{4}\b/g;
const GUIDE = /\b[A-Z]{3}-[A-Z]{3}-\d{3}\b/g;
const FIVE_DIGITS = /\b\d{5}\b/g;

/**
 * Words that carry a labelled fact (program, urgency, network, emergency). A rewrite may not
 * drop them where they exist, nor introduce them where they do not.
 */
export const SIGNAL_WORDS = ["Medicare", "Medicaid", "inpatient", "expedited", "out-of-network", "not in your plan's network", "emergency", "urgent"] as const;

const all = (text: string, re: RegExp) => text.match(re) ?? [];

/** Every exact string a rewrite of `text` must keep. */
export function factsIn(text: string, names: string[] = []): string[] {
  const found = [MONEY, LONG_DATE, NUM_DATE, CODE, DAYS, PHONE, GUIDE, FIVE_DIGITS].flatMap((re) => all(text, re));
  for (const n of names) if (n && text.includes(n)) found.push(n);
  return [...new Set(found)];
}

const signalsIn = (text: string) => SIGNAL_WORDS.filter((w) => text.toLowerCase().includes(w.toLowerCase()));

export type Check = { ok: true } | { ok: false; reason: string };

export function validateRewrite(original: string, rewritten: string, names: string[] = []): Check {
  const r = rewritten.trim();
  if (!r) return { ok: false, reason: "empty rewrite" };
  if (r === original.trim()) return { ok: false, reason: "unchanged" };
  const ratio = r.length / original.length;
  if (ratio < 0.5 || ratio > 2.5) return { ok: false, reason: `length changed too much (${ratio.toFixed(2)}x)` };

  const keep = factsIn(original, names);
  const lost = keep.filter((f) => !r.includes(f));
  if (lost.length) return { ok: false, reason: `lost ${lost.map((f) => JSON.stringify(f)).join(", ")}` };

  const added = factsIn(r).filter((f) => !keep.includes(f));
  if (added.length) return { ok: false, reason: `introduced ${added.map((f) => JSON.stringify(f)).join(", ")}` };

  const before = signalsIn(original);
  const after = signalsIn(r);
  const droppedSignal = before.filter((w) => !after.includes(w));
  if (droppedSignal.length) return { ok: false, reason: `dropped signal ${droppedSignal.join(", ")}` };
  const newSignal = after.filter((w) => !before.includes(w));
  if (newSignal.length) return { ok: false, reason: `added signal ${newSignal.join(", ")}` };

  return { ok: true };
}

/* ------------------------------------------------------------------ minimal CSV (RFC 4180) */

export function toCsv(rows: Record<string, string>[], columns: string[]): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c] ?? "")).join(","))].join("\n") + "\n";
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}
