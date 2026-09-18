/**
 * Layer 1/3 enforcement of "information, not advice": scans generated text for
 * prescriptive or outcome-predictive language. Used on explanations and letters.
 * Kept dependency-free so it runs in tests and on the server.
 */

const PRESCRIPTIVE_PATTERNS: RegExp[] = [
  /\byou (should|must|need to|have to|ought to)\b/i,
  /\bi (recommend|advise|suggest)\b/i,
  /\bwe (recommend|advise)\b/i,
  /\bguaranteed\b/i,
  /\b(will|would|going to) (win|succeed|prevail|be (overturned|reversed|approved))\b/i,
  /\blegal advice\b/i,
  /\byour (best|only) option\b/i,
  /\bstrong(ly)? (case|claim)\b/i,
];

export function findPrescriptive(text: string): string[] {
  const hits: string[] = [];
  for (const re of PRESCRIPTIVE_PATTERNS) {
    const m = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    if (m) hits.push(...m);
  }
  return Array.from(new Set(hits));
}

/** Citation markers look like [[cite:fed.claim_file.free_copies]]. */
const CITE_RE = /\[\[cite:([a-z0-9_.]+)\]\]/g;

export function findCitations(text: string): string[] {
  return Array.from(text.matchAll(CITE_RE), (m) => m[1]);
}

export function unknownCitations(text: string, allowed: Iterable<string>): string[] {
  const ok = new Set(allowed);
  return Array.from(new Set(findCitations(text).filter((id) => !ok.has(id))));
}

/** Strip citation markers whose rule is not in the allowed set; keep the rest. */
export function stripUnknownCitations(text: string, allowed: Iterable<string>): string {
  const ok = new Set(allowed);
  return text.replace(CITE_RE, (whole, id: string) => (ok.has(id) ? whole : ""));
}

/** Placeholders look like [ADD: date of your call with the plan]. */
const PLACEHOLDER_RE = /\[ADD:\s*([^\]]+)\]/g;

export function findPlaceholders(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(PLACEHOLDER_RE), (m) => m[1].trim())));
}
