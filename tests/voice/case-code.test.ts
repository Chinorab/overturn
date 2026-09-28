import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  foreignChars,
  generateCode,
  isCaseCode,
  natoCode,
  normalizeCode,
  spokenCode,
  ssmlCode,
  type CaseCode,
} from "@/lib/voice/case-code";

const code = (s: string) => s as CaseCode;

describe("the alphabet", () => {
  it("has no look-alikes or rhyming letters", () => {
    // 0/O, 1/I/L, 8/B, 5/S read alike; B D E G P T V Z rhyme when spoken over a phone.
    expect(/[01OIL8BZ5SDEGPTV]/.test(CODE_ALPHABET)).toBe(false);
  });

  it("has 19 distinct symbols", () => {
    expect(new Set(CODE_ALPHABET).size).toBe(19);
    expect(CODE_ALPHABET.length).toBe(19);
  });
});

describe("generateCode", () => {
  it("produces 20k unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20_000; i++) codes.add(generateCode((c) => codes.has(c)));
    expect(codes.size).toBe(20_000);
  });

  it("only ever issues characters from the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateCode();
      expect(c.length).toBe(CODE_LENGTH);
      expect(isCaseCode(c)).toBe(true);
    }
  });
});

describe("speaking a code", () => {
  it("splits into two groups of three", () => {
    expect(spokenCode(code("ACF347"))).toBe("A-C-F, 3-4-7");
  });

  it("has a NATO form for a noisy line", () => {
    expect(natoCode(code("ACF347"))).toBe("Alpha, Charlie, Foxtrot — three, four, seven");
  });

  it("has an SSML form that pauses between the groups", () => {
    expect(ssmlCode(code("ACF347"))).toBe(
      '<say-as interpret-as="characters">ACF</say-as><break time="400ms"/><say-as interpret-as="characters">347</say-as>',
    );
  });
});

describe("reading a code back in", () => {
  it("accepts spacing, dashes and lower case", () => {
    expect(normalizeCode(" acf-347 ")).toBe("ACF347");
  });

  it("rejects a character the alphabet never issues", () => {
    expect(normalizeCode("ACO347")).toBe(null);
  });

  it("names the characters that cannot be part of a code", () => {
    // What the assistant needs in order to say "there's no letter O in these codes".
    expect(foreignChars("ac0-3i5")).toEqual(["0", "I", "5"]);
  });
});
