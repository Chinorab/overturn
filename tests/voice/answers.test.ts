import { describe, expect, it } from "vitest";
import {
  OPTIONS,
  parseAnswer,
  parseConfirmation,
  parseDenialCategory,
  parseDocumentDate,
  parsePlanSource,
  parseState,
  parseYesNo,
} from "@/lib/voice/answers";

const T = "2026-10-21";

describe("yes / no / I don't know", () => {
  it.each([
    ["Yes, that's right.", "yes"],
    ["yeah", "yes"],
    ["No, the scan was in September", "no"],
    ["not quite", "no"],
    ["I don't know", "unknown"],
    ["no idea", "unknown"],
  ] as const)("%s -> %s", (said, want) => {
    expect(parseYesNo(said)).toBe(want);
  });

  it("refuses to pick when both words are present", () => {
    // Re-asking costs one turn; guessing wrong costs the person their appeal.
    expect(parseYesNo("yes no wait")).toBe(null);
  });

  it("refuses filler", () => {
    expect(parseYesNo("um")).toBe(null);
  });

  it("answers after the answer do not change it", () => {
    // The leading token decides: people qualify *after* answering.
    expect(parseYesNo("no, it was scheduled")).toBe("no");
    expect(parseYesNo("yes, about two weeks ago")).toBe("yes");
  });
});

describe("confirming a consequential action", () => {
  it("takes only an explicit yes or no", () => {
    expect(parseConfirmation("yes, send it")).toBe("yes");
    expect(parseConfirmation("no, hold off")).toBe("no");
  });

  it("treats a hedge as no answer at all", () => {
    expect(parseConfirmation("maybe")).toBe(null);
  });
});

describe("state", () => {
  it.each([
    ["Texas", "TX"],
    ["I live in new york", "NY"],
    ["New York City", "NY"],
    ["Washington", "WA"],
    ["Washington DC", "DC"],
    ["west virginia", "WV"],
    ["CA", "CA"],
    ["t x", "TX"],
  ] as const)("%s -> %s", (said, want) => {
    expect(parseState(said)).toBe(want);
  });

  it("accepts a bare yes only when a state was offered", () => {
    expect(parseState("yes", "CA")).toBe("CA");
    expect(parseState("yes")).toBe(null);
  });

  it("returns null rather than a guess", () => {
    expect(parseState("the moon")).toBe(null);
  });

  it("has no unknown branch: the state decides the rules, so it must be asked again", () => {
    expect(parseAnswer("state", "I don't know", { today: T })).toBe(null);
  });
});

describe("plan source", () => {
  it.each([
    ["Through my employer", "employer"],
    ["through work", "employer"],
    ["Through my job.", "employer"],
    ["Through Covered California", "marketplace"],
    ["healthcare.gov", "marketplace"],
    ["I bought it myself", "direct"],
    ["something else", "other"],
  ] as const)("%s -> %s", (said, want) => {
    expect(parsePlanSource(said)).toBe(want);
  });

  it("accepts not knowing, because the rules have an unknown branch for it", () => {
    expect(parseAnswer("plan_source", "no idea", { today: T })).toBe("unknown");
  });
});

describe("denial category", () => {
  it.each([
    ["They said there was no prior authorization", "prior_auth"],
    ["not medically necessary", "medical_necessity"],
    ["the doctor was out of network", "out_of_network"],
    ["they called it experimental", "experimental"],
    ["it's not a covered benefit", "not_covered"],
    ["they said it was filed too late", "timely_filing"],
    ["duplicate claim", "duplicate"],
    ["some coding error", "coding_admin"],
    ["something else", "other"],
  ] as const)("%s -> %s", (said, want) => {
    expect(parseDenialCategory(said)).toBe(want);
  });

  it("refuses two reasons at once", () => {
    expect(parseDenialCategory("I think it was out of network or maybe not medically necessary")).toBe(null);
  });

  it("refuses an unrelated word", () => {
    expect(parseDenialCategory("blue")).toBe(null);
  });
});

describe("the date on the document", () => {
  it.each([
    ["about two weeks ago", "2026-10-07", true],
    ["3 days ago", "2026-10-18", true],
    ["a couple of weeks back", "2026-10-07", true],
    ["a month ago", "2026-09-21", true],
    ["last week", "2026-10-14", true],
    ["yesterday", "2026-10-20", false],
    ["September 7th", "2026-09-07", false],
    ["around September 7th", "2026-09-07", true],
    ["early September", "2026-09-05", true],
    ["the 7th of September", "2026-09-07", false],
    ["9/7", "2026-09-07", false],
    ["9/7/2026", "2026-09-07", false],
  ])("%s -> %s (approximate: %s)", (said, value, approximate) => {
    expect(parseDocumentDate(said, T)).toEqual({ value, approximate });
  });

  it("reads a month still to come as last year", () => {
    // A denial letter is never dated in the future, so December on 21 October is 2025.
    expect(parseDocumentDate("December 3rd", T)).toEqual({ value: "2025-12-03", approximate: false });
  });

  it("gives up on something with no date in it", () => {
    expect(parseDocumentDate("a while ago", T)).toBe(null);
  });
});

describe("the dispatcher", () => {
  it("carries the approximate flag through, so the read-back can hedge", () => {
    expect(parseAnswer("document_date", "about two weeks ago", { today: T })).toEqual({
      field: "document_date",
      value: "2026-10-07",
      approximate: true,
    });
  });

  it("reads not knowing whether it was urgent as not urgent", () => {
    // The safe default: the standard deadline is longer than the expedited one.
    expect(parseAnswer("urgent", "not sure", { today: T })).toEqual({ field: "urgent", value: "no" });
  });
});

describe("spoken options", () => {
  it("offers at most four choices per question (FR-001)", () => {
    for (const [question, options] of Object.entries(OPTIONS)) {
      expect(options.length, `${question} offers ${options.length} options`).toBeLessThanOrEqual(4);
    }
  });
});
