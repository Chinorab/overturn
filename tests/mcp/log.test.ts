import { describe, expect, it } from "vitest";
import { createLogger, scrub, toolCallFields } from "@/mcp/src/log";

const NOW = Date.parse("2026-10-21T10:00:00Z");

function capture() {
  const lines: string[] = [];
  const log = createLogger((l) => lines.push(l), { service: "mcp" }, () => NOW);
  return { lines, log, parsed: () => lines.map((l) => JSON.parse(l)) };
}

describe("what a tool call may log", () => {
  it("keeps names, timings and a truncated code", () => {
    const { log, parsed } = capture();
    log.info(
      "tool_call",
      toolCallFields({
        tool: "overturn_send_letter",
        code: "ACF347",
        status: "letter_drafted",
        nextStatus: "sent",
        ms: 12.6,
        outcome: "ok",
      }),
    );
    const line = parsed()[0];
    // Three characters is enough to correlate two log lines and not enough to read a case back.
    expect(line.case).toBe("ACF***");
    expect(line.ms).toBe(13);
    expect(line).toMatchObject({ tool: "overturn_send_letter", status: "letter_drafted", next: "sent", outcome: "ok" });
  });
});

describe("the scrubber", () => {
  it("redacts a denied key whatever it holds", () => {
    expect(scrub("anything", "email")).toBe("[redacted]");
    expect(scrub("anything", "Authorization")).toBe("[redacted]");
    expect(scrub({ facts: { a: 1 } })).toEqual({ facts: "[redacted]" });
  });

  it("redacts what looks sensitive even under an innocent key", () => {
    const out = scrub(
      "send to dana@outlook.com with Bearer eyJabc.def.ghi and member PCH-5590213",
      "note",
    ) as string;
    expect(out).not.toContain("dana@");
    expect(out).not.toContain("eyJ");
    expect(out).not.toContain("5590213");
  });

  it("summarises what is merely large", () => {
    expect(scrub(Array(50).fill(1), "list")).toBe("[array 50]");
    const long = scrub("x".repeat(500), "note") as string;
    expect(long.length).toBeLessThan(80);
    expect(long).toContain("500 chars");
  });

  it("leaves ordinary values alone", () => {
    expect(scrub({ tool: "overturn_answer", ms: 12, ok: true, n: null })).toEqual({
      tool: "overturn_answer",
      ms: 12,
      ok: true,
      n: null,
    });
  });
});

describe("a line that tries to carry a case", () => {
  it("loses every part of it", () => {
    const { log, lines, parsed } = capture();
    log.warn("oops", {
      email: "dana@outlook.com",
      note: "send to dana@outlook.com with Bearer eyJabc.def.ghi and member PCH-5590213",
      authorization: "Bearer zzz",
      text: "x".repeat(500),
      list: Array(50).fill(1),
    });
    const line = parsed()[0];
    expect(line.email).toBe("[redacted]");
    expect(line.authorization).toBe("[redacted]");
    expect(line.text).toBe("[redacted]");
    expect(line.list).toBe("[array 50]");
    expect(line.note).not.toContain("dana@");
    // The one that matters: nowhere in the output, under any key.
    expect(lines.join("\n")).not.toContain("dana@outlook.com");
  });
});

describe("shape", () => {
  it("writes one JSON object per line, with the time and the bound fields", () => {
    const { log, lines, parsed } = capture();
    log.child({ session: "s-1" }).info("started", { port: 8000 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(parsed()[0]).toEqual({
      t: "2026-10-21T10:00:00.000Z",
      level: "info",
      event: "started",
      service: "mcp",
      session: "s-1",
      port: 8000,
    });
  });
});
