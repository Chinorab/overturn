/** Spoken formats (voice-design §8). Pure, dependency-free. */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${numberToWords(-n)}`;
  if (n < 20) return ONES[n] || "zero";
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberToWords(n % 100)}` : ""}`;
  if (n < 1_000_000) return `${numberToWords(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${numberToWords(n % 1000)}` : ""}`;
  return `${numberToWords(Math.floor(n / 1_000_000))} million${n % 1_000_000 ? ` ${numberToWords(n % 1_000_000)}` : ""}`;
}

/** $18,750 → "eighteen thousand seven hundred fifty dollars"; $45.60 → "forty-five dollars and sixty cents" (cents only under $100). */
export function spokenMoney(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const d = dollars === 1 ? "one dollar" : `${numberToWords(dollars)} dollars`;
  if (dollars < 100 && cents > 0) return `${d} and ${numberToWords(cents)} cents`;
  return d;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (d: number) => `${d}${d % 100 >= 11 && d % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][d % 10] ?? "th"}`;

/** 2026-09-04 with today in 2026 → "September 4th"; 2027-03-10 → "March 10th, 2027". */
export function spokenDate(iso: string, today: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ty = Number(today.slice(0, 4));
  return `${MONTHS[m - 1]} ${ordinal(d)}${y === ty ? "" : `, ${y}`}`;
}

/** "w•••@gmail.com" style for text; "w-dot-gmail-dot-com" style for speech. */
export function maskEmail(email: string): { text: string; spoken: string } {
  const [local, domain = ""] = email.split("@");
  const first = local.charAt(0) || "•";
  return { text: `${first}•••@${domain}`, spoken: `${first}-dot-${domain.replace(/\./g, "-dot-")}` };
}

export const countWords = (s: string) => s.replace(/\s+/g, " ").trim().split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** First n sentences of a text. */
const ABBREV = /\b(U\.S|e\.g|i\.e|Dr|Mr|Mrs|Ms|No|vs|etc|Inc|St)\./g;
export function firstSentences(text: string, n: number): string {
  const guarded = text.replace(/\s+/g, " ").trim().replace(ABBREV, (m) => m.replace(/\./g, "\u0000"));
  const s = guarded.match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g) ?? [guarded];
  return s.slice(0, n).map((x) => x.trim().replace(/\u0000/g, ".")).join(" ");
}

/** Remove parentheticals for speech: "a grievance (appeal) with" → "a grievance with". */
export function forSpeech(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\s+/g, " ").trim();
}
