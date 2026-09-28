/**
 * Map what a person said to the engine's values. Pure, deterministic, conservative: when in doubt,
 * return `null` so the assistant re-asks with the options — never guess a state or a reason.
 * (FR-005 "I don't know", FR-014 no-document questions, voice-design §6 recovery, §7 yes/no grammar.)
 */
import { US_STATES, type DenialCategory, type PlanSource, type USStateCode, type YesNoUnknown } from "@/lib/schemas/core";

export type QuestionId = "state" | "plan_source" | "self_funded" | "emergency" | "urgent" | "denial_category" | "document_date" | "correction";

export type Understood =
  | { field: "state"; value: USStateCode }
  | { field: "plan_source"; value: PlanSource }
  | { field: "self_funded" | "emergency"; value: YesNoUnknown }
  | { field: "urgent"; value: "yes" | "no" }
  | { field: "denial_category"; value: DenialCategory }
  | { field: "document_date"; value: string; approximate: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (s: string, ...phrases: string[]) => phrases.some((p) => new RegExp(`(^|\\s)${p}(\\s|$)`).test(s));

// ---------------------------------------------------------------- yes / no / unknown (voice-design §7)
const YES = ["yes", "yeah", "yep", "yup", "correct", "right", "that's right", "thats right", "sure", "please", "go ahead", "do it", "ok", "okay", "affirmative", "true", "send it", "draft it"];
const NO = ["no", "nope", "nah", "wrong", "not quite", "that's not right", "thats not right", "don't", "dont", "stop", "incorrect", "false", "not really", "hold off"];
const UNKNOWN = ["i don't know", "i dont know", "don't know", "dont know", "not sure", "no idea", "i'm not sure", "im not sure", "unsure", "no clue", "can't remember", "cant remember", "skip", "pass", "maybe"];

export function parseYesNo(utterance: string): "yes" | "no" | "unknown" | null {
  const s = norm(utterance);
  if (!s) return null;
  if (UNKNOWN.some((p) => s.includes(p))) return "unknown";
  // A leading yes/no decides: people qualify after the answer ("no, it was scheduled"),
  // and a later word must not cancel the word they actually answered with.
  const lead = (list: string[]) => list.some((p) => s === p || s.startsWith(`${p} `) || s.startsWith(`${p},`));
  const contradictedEarly = (other: string[]) => other.some((p) => has(s.split(" ").slice(1, 3).join(" "), p));
  if (lead(YES)) return contradictedEarly(NO) ? null : "yes";     // "yes no wait" → ask again
  if (lead(NO)) return contradictedEarly(YES) ? null : "no";
  const y = YES.some((p) => has(s, p));
  const n = NO.some((p) => has(s, p));
  if (y && !n) return "yes";
  if (n && !y) return "no";
  return null;                                     // "yes no wait", or nothing recognisable
}

/** Strict yes/no for consequential confirmations: "maybe"/"unknown" is not a yes. */
export function parseConfirmation(utterance: string): "yes" | "no" | null {
  const r = parseYesNo(utterance);
  return r === "yes" || r === "no" ? r : null;
}

// ---------------------------------------------------------------- state
const STATE_NAMES: Record<string, USStateCode> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", "washington dc": "DC", "washington d c": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  // spoken shorthands that speech recognition produces
  cali: "CA", "new york state": "NY", nyc: "NY", "new york city": "NY", "washington state": "WA", "d c": "DC",
};

/** Code → the name a person says, for speech. Built from the same table, longest name wins. */
export const STATE_NAME: Record<string, string> = Object.entries(STATE_NAMES).reduce((acc, [name, code]) => {
  const pretty = name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!acc[code] || pretty.length > acc[code].length) acc[code] = pretty;
  return acc;
}, {} as Record<string, string>);

/** "Texas", "I live in texas", "TX", "new york city" → code. "Washington" alone → WA (state). Nothing sure → null. */
export function parseState(utterance: string, hint?: USStateCode | null): USStateCode | null {
  const s = norm(utterance);
  if (!s) return null;
  if (hint && parseYesNo(s) === "yes") return hint;                       // "yes" to "is that where you live?"
  // longest name first so "new york" beats "york", "west virginia" beats "virginia", "washington dc" beats "washington"
  const names = Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length);
  for (const name of names) if (has(s, name)) return STATE_NAMES[name];
  const twoLetter = s.toUpperCase().replace(/[^A-Z ]/g, "").trim();
  if (twoLetter.length === 2 && (US_STATES as readonly string[]).includes(twoLetter)) return twoLetter as USStateCode;
  const spelled = s.replace(/\s/g, "").toUpperCase();                      // "t x" → "TX"
  if (spelled.length === 2 && (US_STATES as readonly string[]).includes(spelled)) return spelled as USStateCode;
  return null;
}

// ---------------------------------------------------------------- plan source
export function parsePlanSource(utterance: string): PlanSource | null {
  const s = norm(utterance);
  if (!s) return null;
  if (/\b(employer|work|job|company|my boss|through my husband's|through my wife's|spouse|union|cobra)\b/.test(s)) return "employer";
  if (/\b(marketplace|exchange|healthcare gov|health care gov|obamacare|aca|covered california|covered ca|get covered|connect for health|maryland health|ny state of health|nystateofhealth|pennie|vermont health|access health|mnsure|kynect|washington healthplanfinder|beWellnm|nevada health link|your health idaho)\b/i.test(s)) return "marketplace";
  if (/\b(direct|directly|myself|on my own|bought it|from the insurer|from the company|broker|agent|individual|private)\b/.test(s)) return "direct";
  if (/\b(other|something else|not sure which|don't know|dont know|no idea)\b/.test(s)) return "other";
  return null;
}

// ---------------------------------------------------------------- denial category
const CATEGORY_PATTERNS: [DenialCategory, RegExp][] = [
  ["prior_auth", /\b(prior auth|pre auth|preauth|authorization|authorisation|pre approval|preapproval|not approved in advance|didn't get approval|no approval|referral)\b/],
  ["medical_necessity", /\b(not medically necessary|medically necessary|medical necessity|not necessary|unnecessary|didn't need|not needed|no medical reason)\b/],
  ["out_of_network", /\b(out of network|out of the network|not in network|non network|not a network provider|surprise bill|balance bill)\b/],
  ["experimental", /\b(experimental|investigational|not proven|unproven|clinical trial|off label)\b/],
  ["not_covered", /\b(not covered|not a covered|exclusion|excluded|doesn't cover|does not cover|no coverage|benefit limit|maximum reached|not a benefit)\b/],
  ["coding_admin", /\b(coding|code was wrong|wrong code|billing error|paperwork|clerical|administrative|missing information|incomplete claim|wrong form)\b/],
  ["timely_filing", /\b(too late|timely filing|filed late|late filing|past the deadline|missed the deadline|not filed in time)\b/],
  ["duplicate", /\b(duplicate|already paid|billed twice|paid twice|double billed)\b/],
];

export function parseDenialCategory(utterance: string): DenialCategory | null {
  const s = norm(utterance);
  if (!s) return null;
  const hits = CATEGORY_PATTERNS.filter(([, re]) => re.test(s)).map(([c]) => c);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    // "no prior authorization because it wasn't medically necessary" → the first mentioned wins only if clearly first
    const first = hits.map((c) => ({ c, i: s.search(CATEGORY_PATTERNS.find(([k]) => k === c)![1]) })).sort((a, b) => a.i - b.i);
    return first[0].i === 0 ? first[0].c : null;
  }
  if (/\b(other|something else|don't know|dont know|not sure|no reason|didn't say)\b/.test(s)) return "other";
  return null;
}

// ---------------------------------------------------------------- dates (approximate on purpose)
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3, several: 3 };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * "about two weeks ago", "last week", "yesterday", "September 7th", "9/7", "early September", "a month ago"
 * → ISO date + approximate flag. Relative phrases are anchored on `today` (ISO). Future dates → null.
 */
export function parseDocumentDate(utterance: string, today: string): { value: string; approximate: boolean } | null {
  const s = norm(utterance);
  if (!s) return null;
  const t = new Date(`${today}T00:00:00Z`);
  const approxWords = /\b(about|around|roughly|maybe|approximately|i think|something like|or so|ish)\b/.test(s);

  if (/\b(today|this morning|just now)\b/.test(s)) return { value: today, approximate: false };
  if (/\byesterday\b/.test(s)) return { value: iso(addDays(t, -1)), approximate: false };
  if (/\b(day before yesterday)\b/.test(s)) return { value: iso(addDays(t, -2)), approximate: false };

  const rel = s.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple of|couple|few|several|\d{1,2})\s+(days?|weeks?|months?)\s+(ago|back)\b/);
  if (rel) {
    const n = /^\d/.test(rel[1]) ? Number(rel[1]) : WORD_NUM[rel[1].replace(" of", "")] ?? 1;
    const unit = rel[2].startsWith("day") ? 1 : rel[2].startsWith("week") ? 7 : 30;
    return { value: iso(addDays(t, -n * unit)), approximate: true };
  }
  if (/\blast week\b/.test(s)) return { value: iso(addDays(t, -7)), approximate: true };
  if (/\blast month\b/.test(s)) return { value: iso(addDays(t, -30)), approximate: true };
  if (/\b(a while ago|a while back|some time ago|long time ago)\b/.test(s)) return null;      // too vague: re-ask

  // "september 7th", "7th of september", "sept 7", "early/mid/late september"
  const mIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m.slice(0, 3)}[a-z]*\\b`).test(s));
  if (mIdx >= 0) {
    const year = (s.match(/\b(20\d{2})\b/) ?? [])[1];
    const day = (s.match(/\b(\d{1,2})(st|nd|rd|th)?\b/) ?? [])[1];
    const part = /\bearly\b/.test(s) ? 5 : /\bmid\b/.test(s) ? 15 : /\b(late|end of)\b/.test(s) ? 25 : null;
    const d = day ? Number(day) : part ?? 15;
    let y = year ? Number(year) : t.getUTCFullYear();
    let cand = new Date(Date.UTC(y, mIdx, d));
    if (!year && cand > t) { y -= 1; cand = new Date(Date.UTC(y, mIdx, d)); }               // "September" said in January → last year
    if (cand > t) return null;
    return { value: iso(cand), approximate: !day || approxWords };
  }
  const numeric = s.match(/\b(\d{1,2})[\/ ](\d{1,2})(?:[\/ ](\d{2,4}))?\b/);                 // 9/7 or 9/7/2026
  if (numeric) {
    const y = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : t.getUTCFullYear();
    const cand = new Date(Date.UTC(y, Number(numeric[1]) - 1, Number(numeric[2])));
    if (Number.isNaN(cand.getTime()) || cand > t) return null;
    return { value: iso(cand), approximate: approxWords };
  }
  return null;
}

// ---------------------------------------------------------------- dispatcher
/** One entry point for `overturn_answer`. `hint` is the extraction's state_hint for the state question. */
export function parseAnswer(question: QuestionId, utterance: string, ctx: { today: string; stateHint?: USStateCode | null } = { today: new Date().toISOString().slice(0, 10) }): Understood | "unknown" | null {
  const s = norm(utterance);
  const unknown = UNKNOWN.some((p) => s.includes(p));
  switch (question) {
    case "state": { const v = parseState(utterance, ctx.stateHint); return v ? { field: "state", value: v } : null; }   // no "unknown" for the state
    case "plan_source": { if (unknown) return "unknown"; const v = parsePlanSource(utterance); return v ? { field: "plan_source", value: v } : null; }
    case "self_funded": case "emergency": { const v = parseYesNo(utterance); return v ? { field: question, value: v } : null; }
    case "urgent": { const v = parseYesNo(utterance); return v === "yes" || v === "no" ? { field: "urgent", value: v } : v === "unknown" ? { field: "urgent", value: "no" } : null; }
    case "denial_category": { if (unknown) return "unknown"; const v = parseDenialCategory(utterance); return v ? { field: "denial_category", value: v } : null; }
    case "document_date": { if (unknown) return "unknown"; const v = parseDocumentDate(utterance, ctx.today); return v ? { field: "document_date", ...v } : null; }
    case "correction": return null;   // handled by the tool with the field name
  }
}

/** The ≤ 4 spoken options the assistant re-lists when an answer was not understood. */
export const OPTIONS: Record<Exclude<QuestionId, "correction" | "document_date" | "state">, string[]> = {
  plan_source: ["through an employer", "the Marketplace", "bought directly"],
  self_funded: ["yes", "no", "I don't know"],
  emergency: ["yes", "no", "I don't know"],
  urgent: ["yes", "no"],
  denial_category: ["not medically necessary", "no prior authorization", "out of network", "something else"],
};
