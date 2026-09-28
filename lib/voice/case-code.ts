/**
 * Six-character case codes for the companion page. Alphabet without look-alike or sound-alike
 * pairs (no 0/O, 1/I/L, 8/B, 5/S; no B/D/E/G/P/T/V/Z which rhyme with each other). 19 symbols,
 * 19^6 ≈ 47 million codes. Pure except `generate`, which takes an injectable random source.
 */
export const CODE_ALPHABET = "ACFHJKMNQRWXY234679";
export const CODE_LENGTH = 6;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

const NATO: Record<string, string> = {
  A: "Alpha", C: "Charlie", F: "Foxtrot", H: "Hotel", J: "Juliet", K: "Kilo", M: "Mike", N: "November",
  Q: "Quebec", R: "Romeo", W: "Whiskey", X: "X-ray", Y: "Yankee",
  "2": "two", "3": "three", "4": "four", "6": "six", "7": "seven", "9": "nine",
};

export type CaseCode = string & { readonly __brand: "CaseCode" };

export function isCaseCode(s: string): s is CaseCode {
  return CODE_RE.test(s);
}

/** Random code from an injectable source (default: crypto). `taken` lets the store enforce uniqueness and tombstones. */
export function generateCode(taken: (code: string) => boolean = () => false, random: () => number = cryptoRandom): CaseCode {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    if (!taken(code)) return code as CaseCode;
  }
  throw new Error("could not generate a free case code");
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/**
 * Normalize what a person typed on the companion page: case, spaces and dashes only. Characters the
 * alphabet never issues (O, 0, I, 1, L, B, 8, Z, …) are not "rescued" by guessing — the page tells the
 * person which characters can appear, and the assistant can repeat the code in NATO words.
 */
export function normalizeCode(input: string): CaseCode | null {
  const strict = input.toUpperCase().replace(/[\s-]/g, "");
  return isCaseCode(strict) ? strict : null;
}

/** Characters a person typed that can never be in a code — for the companion page's hint. */
export function foreignChars(input: string): string[] {
  const strict = input.toUpperCase().replace(/[\s-]/g, "");
  return [...new Set(strict.split("").filter((c) => !CODE_ALPHABET.includes(c)))];
}

/** "ACF347" → "A-C-F, 3-4-7" (letters spelled, two groups of three, a breath between). */
export function spokenCode(code: CaseCode): string {
  const chars = code.split("");
  return `${chars.slice(0, 3).join("-")}, ${chars.slice(3).join("-")}`;
}

/** "ACF347" → "Alpha, Charlie, Foxtrot — three, four, seven" for "repeat". */
export function natoCode(code: CaseCode): string {
  const chars = code.split("").map((c) => NATO[c] ?? c);
  return `${chars.slice(0, 3).join(", ")} — ${chars.slice(3).join(", ")}`;
}

/** SSML for Polly: characters spelled one by one, short pause between the two groups. */
export function ssmlCode(code: CaseCode): string {
  const g = (s: string) => `<say-as interpret-as="characters">${s}</say-as>`;
  return `${g(code.slice(0, 3))}<break time="400ms"/>${g(code.slice(3))}`;
}
