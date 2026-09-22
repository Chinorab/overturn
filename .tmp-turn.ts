/**
 * Deterministic shape check for one spoken assistant turn.
 * Pure: no I/O, no model. Same code runs in the server tests, the simulator's post-check,
 * and the golden transcript replay.
 */

export type TurnKind =
  | "normal"          // any ordinary turn: ≤ 60 words, exactly one question, last
  | "rights_chunk"    // a chunk from overturn_compute_rights: ≤ 120 words, one question
  | "code_readout"    // the case code turn: identifiers allowed
  | "closing"         // the final turn after send/discard/stop: no question required, ≤ 60 words
  | "readback_only";  // a read-back re-spoken on "repeat": question expected (it ends with "Is that right?")

export type ViolationCode =
  | "too_many_questions" | "question_not_last" | "missing_question" | "too_long" | "too_many_options"
  | "advice_language" | "spoken_url" | "spoken_email" | "spoken_identifier" | "tone" | "confirmation_not_verbatim";

export type Violation = { code: ViolationCode; detail: string };

export type CheckOptions = {
  kind?: TurnKind;
  /** When the tool returned needs_confirmation, the exact question the turn must be. */
  expectedQuestion?: string;
};

export type CheckResult = { ok: boolean; violations: Violation[]; words: number; questions: number; options: number };

export const LIMITS: Record<TurnKind, { words: number; questions: [number, number] }> = {
  normal:        { words: 60,  questions: [1, 1] },
  rights_chunk:  { words: 120, questions: [1, 1] },
  code_readout:  { words: 60,  questions: [0, 1] },
  closing:       { words: 60,  questions: [0, 0] },
  readback_only: { words: 60,  questions: [1, 1] },
};

/** Same patterns as lib/ai/guard.ts (kept in sync by tests/voice/turn-check.test.ts). */
const PRESCRIPTIVE: RegExp[] = [
  /\byou (should|must|need to|have to|ought to)\b/i,
  /\bi (recommend|advise|suggest)\b/i,
  /\bwe (recommend|advise)\b/i,
  /\bguaranteed\b/i,
  /\b(will|would|going to) (win|succeed|prevail|be (overturned|reversed|approved))\b/i,
  /\blegal advice\b/i,
  /\byour (best|only) option\b/i,
  /\bstrong(ly)? (case|claim)\b/i,
];

/** The disclaimer the persona must say; removed before the advice scan. */
const DISCLAIMER_FORMS = /\b(information,? not legal advice|not legal advice|isn't legal advice|is not legal advice|rather than legal advice)\b/gi;

const HINT_MAX_WORDS = 10;
const BANNED_OPENERS = /^(great question|absolutely|i'd be happy to|certainly|of course|sure thing)\b/i;
const URL_RE = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|org|gov|net|edu)\b/i;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/;
/** ≥ 7 alphanumerics containing at least one digit and one letter, or ≥ 9 digits: member/claim numbers, phone numbers. */
const IDENTIFIER_RE = /\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{7,}\b|\b\d[\d -]{8,}\d\b/;

const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

export const countWords = (s: string) => normalize(s).split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** Split on sentence terminators, keeping the terminator. Em-dashes and semicolons do not split. */
export function sentences(s: string): string[] {
  return normalize(s).match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [];
}

/** Options offered by a question: "A, B, or C?" → 3; "yes or no?" → 2; no list → 0. */
export function countOptions(question: string): number {
  const q = question.replace(/\?$/, "");
  const orIdx = q.search(/\sor\s/);
  if (orIdx < 0) return 0;
  // Take the clause after the last dash/colon/"—" if any, so "how do you get it — A, B, or C" counts only the list.
  const clause = q.split(/\s[—:–]\s/).pop()!;
  const parts = clause.split(/,\s*|\sor\s/).map((p) => p.trim()).filter(Boolean);
  return parts.length;
}

export function checkTurn(text: string, opts: CheckOptions = {}): CheckResult {
  const kind = opts.kind ?? "normal";
  const limits = LIMITS[kind];
  const v: Violation[] = [];
  const t = normalize(text);
  const sents = sentences(t);
  const words = countWords(t);
  const qs = sents.filter((s) => s.endsWith("?") || s.endsWith('?"'));
  const questions = qs.length;

  // 1. question count and position
  if (questions > limits.questions[1]) v.push({ code: "too_many_questions", detail: `${questions} questions` });
  if (questions < limits.questions[0]) v.push({ code: "missing_question", detail: "turn must end with one question" });
  if (questions >= 1) {
    const lastQ = sents.findLastIndex((s) => s.endsWith("?") || s.endsWith('?"'));
    const trailing = sents.slice(lastQ + 1);
    // One short hint after the question is allowed ("You can say I don't know."), nothing more.
    const hintOk = trailing.length === 0 || (trailing.length === 1 && countWords(trailing[0]) <= HINT_MAX_WORDS);
    if (!hintOk) v.push({ code: "question_not_last", detail: `after the question: "${trailing.join(" ")}"` });
  }

  // 2. length
  if (words > limits.words) v.push({ code: "too_long", detail: `${words} words > ${limits.words}` });

  // 3. options
  const options = questions ? countOptions(qs.at(-1)!) : 0;
  if (options > 4) v.push({ code: "too_many_options", detail: `${options} options` });

  // 4. advice language, with the disclaimer exempted
  const scanned = t.replace(DISCLAIMER_FORMS, "");
  for (const re of PRESCRIPTIVE) {
    const m = scanned.match(re);
    if (m) v.push({ code: "advice_language", detail: m[0] });
  }

  // 5. things that must not be spoken
  if (URL_RE.test(t)) v.push({ code: "spoken_url", detail: t.match(URL_RE)![0] });
  if (EMAIL_RE.test(t)) v.push({ code: "spoken_email", detail: t.match(EMAIL_RE)![0] });
  if (kind !== "code_readout" && IDENTIFIER_RE.test(t)) v.push({ code: "spoken_identifier", detail: t.match(IDENTIFIER_RE)![0] });

  // 6. tone
  if (/!/.test(t)) v.push({ code: "tone", detail: "exclamation mark" });
  if (BANNED_OPENERS.test(t)) v.push({ code: "tone", detail: t.match(BANNED_OPENERS)![0] });

  // 7. verbatim confirmation
  if (opts.expectedQuestion && normalize(opts.expectedQuestion).toLowerCase() !== t.toLowerCase()) {
    v.push({ code: "confirmation_not_verbatim", detail: `expected "${normalize(opts.expectedQuestion)}"` });
  }

  return { ok: v.length === 0, violations: v, words, questions, options };
}

/** Deterministic repair for the repairable rules (1, 2, 6). Never touches rules 4, 5, 7. */
export function repairTurn(text: string, opts: CheckOptions = {}): string {
  const kind = opts.kind ?? "normal";
  const limits = LIMITS[kind];
  let sents = sentences(text).map((s) => s.replace(/!/g, "."));
  if (sents.length && BANNED_OPENERS.test(sents[0])) {
    sents[0] = sents[0].replace(BANNED_OPENERS, "").replace(/^[,.!\s]+/, "");
    if (!sents[0]) sents.shift();
  }
  // keep everything up to and including the first question; drop later questions
  const firstQ = sents.findIndex((s) => s.endsWith("?"));
  if (firstQ >= 0 && limits.questions[1] === 1) sents = sents.slice(0, firstQ + 1);
  // shrink from the front (keep the question) until under the word limit
  while (sents.length > 1 && countWords(sents.join(" ")) > limits.words) sents.splice(sents.length - 2, 1);
  return sents.join(" ");
}
