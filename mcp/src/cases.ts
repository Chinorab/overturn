/**
 * The one case store for this process.
 *
 * A singleton because the store *is* the process's memory: a second instance would mean a code
 * issued in one place and unknown in another. It holds nothing across a restart, which is the
 * point (FR-040) — losing every case when the server stops is the storage policy, not a gap in it.
 */
import { CaseStore } from "./store";
import { IDLE_TTL_MS, clock } from "./clock";
import type { CaseFacts } from "./facts";

/** How long a code stays blocked from reissue after its case ends: someone may still say it. */
const tombstoneMs = Number(process.env.MCP_CODE_TOMBSTONE_HOURS ?? 24) * 3_600_000;

export const store = new CaseStore<CaseFacts>({ ttlMs: IDLE_TTL_MS, tombstoneMs, clock });
