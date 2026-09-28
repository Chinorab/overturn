/**
 * The one case store for this process.
 *
 * A singleton because the store *is* the process's memory: a second instance would mean a code
 * issued in one place and unknown in another. It holds nothing across a restart, which is the
 * point (FR-040) — losing every case when the server stops is the storage policy, not a gap in it.
 */
import { CaseStore } from "./store";
import { clock } from "./clock";
import type { CaseFacts } from "./facts";

const ttlMinutes = Number(process.env.MCP_CASE_TTL_MINUTES ?? 30);

export const store = new CaseStore<CaseFacts>({ ttlMs: ttlMinutes * 60_000, clock });
