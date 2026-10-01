/**
 * The server's clock.
 *
 * In production it is `Date.now`. The conformance test needs deadlines that do not move between
 * runs and needs to jump forward thirty minutes without waiting, so setting `OVERTURN_CLOCK` to an
 * ISO instant pins the clock there and lets `POST /__test/clock` advance it.
 *
 * The test route exists only when that variable is set: there is no flag to flip in production,
 * and nothing to reach if someone tries.
 */

const base = process.env.OVERTURN_CLOCK ? Date.parse(process.env.OVERTURN_CLOCK) : NaN;

/** True when the clock is pinned — the only condition under which the test route is mounted. */
export const IS_TEST_CLOCK = Number.isFinite(base);

let offset = 0;

export const clock: () => number = IS_TEST_CLOCK ? () => base + offset : () => Date.now();

/** Move the pinned clock forward. Throws if the clock is real, so a misconfiguration is loud. */
export function advanceMinutes(minutes: number): number {
  if (!IS_TEST_CLOCK) throw new Error("advanceMinutes requires OVERTURN_CLOCK");
  if (!Number.isFinite(minutes)) throw new Error("advanceMinutes: minutes must be a number");
  offset += minutes * 60_000;
  return clock();
}

/** ISO form of now, for logs and for the rules engine's `today`. */
export const todayISO = (): string => new Date(clock()).toISOString().slice(0, 10);

/**
 * How long a case lives without a request: thirty minutes, then its facts are freed (FR-040).
 * The session that owns it lives for SESSION_IDLE_TTL_MS, below.
 */
export const IDLE_TTL_MS = Number(process.env.MCP_CASE_TTL_MINUTES ?? 30) * 60_000;

/**
 * A session outlives its cases on purpose. When someone comes back at minute 31, the case is
 * already gone — its facts freed on time — but the session must still be there so the tool layer
 * can *say* so ("your case expired after thirty minutes"). Swept at the same instant, the person
 * would get a transport error instead of an explanation. Twice the case TTL keeps the bearer and
 * the email bounded, which is the point, without costing that sentence.
 */
export const SESSION_IDLE_TTL_MS = 2 * IDLE_TTL_MS;
