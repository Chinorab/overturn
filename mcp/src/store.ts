/**
 * In-memory case store. Nothing is persisted (FR-040). One Map, an injectable clock, idle expiry,
 * 24-hour tombstones so a spoken code is never reused while someone might still say it, and
 * session ownership so a code from one MCP session cannot be read from another.
 */
import { generateCode, type CaseCode } from "@/lib/voice/case-code";
import { CLOSED, type Status } from "./machine";

export type Clock = () => number;                       // ms since epoch; injectable for tests and OVERTURN_CLOCK

export type CaseRecord<TFacts = unknown> = {
  code: CaseCode;
  sessionId: string;
  status: Status;
  path: "document" | "sample" | "no_document" | null;
  facts: TFacts;                                        // extraction, answers, situation, rights, letter, delivery — typed by the tools layer
  account: { email: string; emailMasked: string; emailMaskedSpoken: string } | null;
  createdAt: number;
  lastActivityAt: number;
};

export type StoreOptions = { ttlMs?: number; tombstoneMs?: number; clock?: Clock; random?: () => number };

export type Lookup<T> =
  | { ok: true; record: CaseRecord<T> }
  | { ok: false; error: "case_not_found" | "wrong_session" | "case_closed" };

export class CaseStore<T = unknown> {
  private readonly cases = new Map<string, CaseRecord<T>>();
  private readonly tombstones = new Map<string, number>();   // code → expiry
  private readonly ttlMs: number;
  private readonly tombstoneMs: number;
  private readonly clock: Clock;
  private readonly random?: () => number;

  constructor(opts: StoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 30 * 60_000;
    this.tombstoneMs = opts.tombstoneMs ?? 24 * 3_600_000;
    this.clock = opts.clock ?? (() => Date.now());
    this.random = opts.random;
  }

  create(sessionId: string, facts: T, account: CaseRecord["account"]): CaseRecord<T> {
    this.sweep();
    const code = generateCode((c) => this.cases.has(c) || this.tombstones.has(c), this.random);
    const now = this.clock();
    const record: CaseRecord<T> = { code, sessionId, status: "started", path: null, facts, account, createdAt: now, lastActivityAt: now };
    this.cases.set(code, record);
    return record;
  }

  /** Get a live case for this session; touches lastActivityAt. */
  get(code: string, sessionId: string): Lookup<T> {
    this.sweep();
    const rec = this.cases.get(code.toUpperCase());
    if (!rec) return { ok: false, error: "case_not_found" };
    if (rec.sessionId !== sessionId) return { ok: false, error: "wrong_session" };
    if (CLOSED.has(rec.status)) return { ok: false, error: "case_closed" };
    rec.lastActivityAt = this.clock();
    return { ok: true, record: rec };
  }

  /** Closed cases stay readable for `case_closed` answers until swept; `close` frees the facts immediately. */
  close(code: string, status: "sent" | "discarded"): void {
    const rec = this.cases.get(code.toUpperCase());
    if (!rec) return;
    rec.status = status;
    rec.facts = null as unknown as T;                    // PHI freed now; the shell remains only to answer case_closed
    rec.account = null;
    this.tombstones.set(rec.code, this.clock() + this.tombstoneMs);
  }

  /** Drop the record entirely (after expiry or on session end). The tombstone keeps the code blocked. */
  forget(code: string): void {
    const key = code.toUpperCase();
    if (this.cases.delete(key)) this.tombstones.set(key, this.clock() + this.tombstoneMs);
  }

  /** End of an MCP session: every case it owned is discarded. */
  endSession(sessionId: string): number {
    let n = 0;
    for (const rec of [...this.cases.values()]) if (rec.sessionId === sessionId) { this.forget(rec.code); n++; }
    return n;
  }

  /** Expire idle cases; called on every access so no timer is needed. */
  sweep(): void {
    const now = this.clock();
    for (const rec of [...this.cases.values()]) {
      if (now - rec.lastActivityAt > this.ttlMs) this.forget(rec.code);
    }
    for (const [code, until] of this.tombstones) if (until <= now) this.tombstones.delete(code);
  }

  /** For /healthz and tests only: counts, never contents. */
  stats(): { live: number; closed: number; tombstoned: number } {
    let live = 0, closed = 0;
    for (const rec of this.cases.values()) if (CLOSED.has(rec.status)) closed++; else live++;
    return { live, closed, tombstoned: this.tombstones.size };
  }
}
