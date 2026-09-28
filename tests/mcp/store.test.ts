import { beforeEach, describe, expect, it } from "vitest";
import { CaseStore } from "@/mcp/src/store";

const ACCOUNT = { email: "walter.demo@gmail.com", emailMasked: "w•••@gmail.com", emailMaskedSpoken: "w-dot-gmail-dot-com" };

let now = 0;
let store: CaseStore<{ n: number }>;

beforeEach(() => {
  now = Date.parse("2026-10-21T10:00:00Z");
  store = new CaseStore<{ n: number }>({ clock: () => now, ttlMs: 30 * 60_000, tombstoneMs: 24 * 3_600_000 });
});

describe("creating a case", () => {
  it("issues a code from the spoken alphabet", () => {
    expect(store.create("sess-A", { n: 1 }, ACCOUNT).code).toMatch(/^[ACFHJKMNQRWXY234679]{6}$/);
  });
});

describe("who may read a case", () => {
  it("answers its own session, in any casing", () => {
    const a = store.create("sess-A", { n: 1 }, ACCOUNT);
    expect(store.get(a.code, "sess-A").ok).toBe(true);
    // The person may read the code back from the companion page in lower case.
    expect(store.get(a.code.toLowerCase(), "sess-A").ok).toBe(true);
  });

  it("refuses another session holding the same code", () => {
    const a = store.create("sess-A", { n: 1 }, ACCOUNT);
    const other = store.get(a.code, "sess-B");
    expect(other.ok === false && other.error).toBe("wrong_session");
  });

  it("refuses a code it never issued", () => {
    const miss = store.get("XXXXXX", "sess-A");
    expect(miss.ok === false && miss.error).toBe("case_not_found");
  });
});

describe("idle expiry", () => {
  it("survives while it is being used, and dies 30 minutes after it stops", () => {
    const a = store.create("sess-A", { n: 1 }, ACCOUNT);
    now += 29 * 60_000;
    expect(store.get(a.code, "sess-A").ok).toBe(true); // reading it resets the clock
    now += 31 * 60_000;
    const gone = store.get(a.code, "sess-A");
    expect(gone.ok === false && gone.error).toBe("case_not_found");
  });

  it("blocks the code from reissue after it expires", () => {
    const a = store.create("sess-A", { n: 1 }, ACCOUNT);
    now += 31 * 60_000;
    store.sweep();
    expect(store.stats()).toEqual({ live: 0, closed: 0, tombstoned: 1 });
    expect(a.code).toBeTruthy();
  });
});

describe("closing a case", () => {
  it("frees the facts at once and answers case_closed", () => {
    const b = store.create("sess-A", { n: 2 }, ACCOUNT);
    store.close(b.code, "sent");
    const after = store.get(b.code, "sess-A");
    expect(after.ok === false && after.error).toBe("case_closed");
    // The shell that answers case_closed must not still be holding the document's contents.
    expect(b.facts).toBe(null);
    expect(b.account).toBe(null);
  });

  it("closes on a lower-case code too, because get accepts one", () => {
    // The asymmetry would have been silent: a discard that no-ops leaves a live case holding
    // the document's contents, which is the one thing the store promises not to do.
    const b = store.create("sess-A", { n: 2 }, ACCOUNT);
    store.close(b.code.toLowerCase(), "discarded");
    const after = store.get(b.code, "sess-A");
    expect(after.ok === false && after.error).toBe("case_closed");
    expect(b.facts).toBe(null);
  });

  it("never reissues a code someone may still be holding", () => {
    const b = store.create("sess-A", { n: 2 }, ACCOUNT);
    store.close(b.code, "sent");
    for (let i = 0; i < 5000; i++) {
      expect(store.create("s", { n: 0 }, null).code).not.toBe(b.code);
    }
  });
});

describe("ending an MCP session", () => {
  it("discards everything that session owned", () => {
    const c = store.create("sess-C", { n: 3 }, ACCOUNT);
    store.create("sess-D", { n: 4 }, ACCOUNT);
    expect(store.endSession("sess-C")).toBe(1);
    const gone = store.get(c.code, "sess-C");
    expect(gone.ok === false && gone.error).toBe("case_not_found");
    expect(store.stats().live).toBe(1);
  });
});

describe("tombstones", () => {
  it("clear 24 hours after the case ended", () => {
    store.create("sess-A", { n: 1 }, ACCOUNT);
    now += 31 * 60_000;
    store.sweep();
    expect(store.stats().live).toBe(0);
    expect(store.stats().tombstoned).toBe(1);
    now += 25 * 3_600_000;
    store.sweep();
    expect(store.stats().tombstoned).toBe(0);
  });
});

describe("stats", () => {
  it("returns counts and nothing else, because /healthz is public", () => {
    store.create("sess-A", { n: 1 }, ACCOUNT);
    const b = store.create("sess-A", { n: 2 }, ACCOUNT);
    store.close(b.code, "discarded");
    const s = store.stats();
    expect(s).toEqual({ live: 1, closed: 1, tombstoned: 1 });
    expect(Object.keys(s)).toEqual(["live", "closed", "tombstoned"]);
    expect(JSON.stringify(s)).not.toContain(b.code);
  });
});
