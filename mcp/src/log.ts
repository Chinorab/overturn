/**
 * Scrubbed structured logger (FR-043). Logs carry timings, tool names, status transitions, error
 * codes and counts — never document text, extracted facts, letter text, or email addresses.
 * Defence in depth: the scrubber also redacts anything that *looks* like an email, a bearer, a JWT,
 * a long identifier or a large blob, in case a caller passes one by mistake.
 */

export type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const DENY_KEYS = new Set([
  "email", "to", "recipient", "authorization", "bearer", "token", "access_token", "id_token", "refresh_token",
  "document", "base64", "text", "letter", "summary", "quote", "facts", "extraction", "answers", "situation", "utterance", "speak", "body",
]);
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
const BEARER_RE = /\bBearer\s+\S+/gi;
const LONG_ID_RE = /\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{7,}\b/g;   // member/claim numbers
const MAX_STRING = 120;

export function scrub(value: unknown, key = ""): unknown {
  if (DENY_KEYS.has(key.toLowerCase())) return "[redacted]";
  if (typeof value === "string") {
    let s = value.replace(JWT_RE, "[jwt]").replace(BEARER_RE, "Bearer [redacted]").replace(EMAIL_RE, "[email]").replace(LONG_ID_RE, "[id]");
    if (s.length > MAX_STRING) s = `${s.slice(0, 40)}…[${value.length} chars]`;
    return s;
  }
  if (Array.isArray(value)) return value.length > 20 ? `[array ${value.length}]` : value.map((v) => scrub(v));
  if (value && typeof value === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(value as Fields)) out[k] = scrub(v, k);
    return out;
  }
  return value;
}

export type Logger = {
  log: (level: Level, event: string, fields?: Fields) => void;
  info: (event: string, fields?: Fields) => void;
  warn: (event: string, fields?: Fields) => void;
  error: (event: string, fields?: Fields) => void;
  debug: (event: string, fields?: Fields) => void;
  child: (base: Fields) => Logger;
};

export function createLogger(write: (line: string) => void = (l) => process.stderr.write(l + "\n"), base: Fields = {}, clock: () => number = Date.now): Logger {
  const log = (level: Level, event: string, fields: Fields = {}) => {
    const rec = { t: new Date(clock()).toISOString(), level, event, ...scrub({ ...base, ...fields }) as Fields };
    write(JSON.stringify(rec));
  };
  return {
    log,
    info: (e, f) => log("info", e, f),
    warn: (e, f) => log("warn", e, f),
    error: (e, f) => log("error", e, f),
    debug: (e, f) => log("debug", e, f),
    child: (more) => createLogger(write, { ...base, ...more }, clock),
  };
}

/** What a tool call is allowed to log: names, codes, durations, sizes — nothing from the case. */
export function toolCallFields(args: { tool: string; code?: string; status?: string; nextStatus?: string; ms: number; outcome: "ok" | "error" | "needs_confirmation" | "wrong_state"; errorCode?: string; inputBytes?: number }): Fields {
  return { tool: args.tool, case: args.code ? args.code.slice(0, 3) + "***" : undefined, status: args.status, next: args.nextStatus, ms: Math.round(args.ms), outcome: args.outcome, error: args.errorCode, inputBytes: args.inputBytes };
}
