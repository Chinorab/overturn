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
