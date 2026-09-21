#!/usr/bin/env node
// Validate the us-health-appeal-rules dataset. No dependencies: `node validate.mjs`.
//
// Checks
//   1. every file in rules/ is a JSON array of rules matching the schema below
//   2. jurisdiction matches the file name (federal.json → "federal", ca.json → "CA", …)
//   3. ids are unique across all files and follow `xx.topic.detail`
//   4. source_url is https; last_verified is a real date, not in the future, ≤ MAX_AGE_DAYS old
//   5. applies_if only uses known keys and enum values; deadline block is well-formed
//   6. help-resources.json matches its schema, and every state present in rules/ has at least
//      one help entry (a rule that leads nowhere is a dead end)
//   7. summaries stay ≤ 60 words and contain no advice phrases
//
// Exit code 0 = valid. Anything else prints one line per problem and exits 1.
//
// Options
//   --rules <dir>    default ./rules
//   --help <file>    default ./help-resources.json
//   --max-age <n>    default 45 (days since last_verified)
//   --today <date>   default now (ISO date, for reproducible CI runs)
//   --quiet          only print problems

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// ---------------------------------------------------------------- enums (mirror schema.json)
const US_STATES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH " +
  "NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR").split(" ");
const CATEGORY = ["deadline", "protection", "right", "process"];
const PLAN_SOURCE = ["employer", "marketplace", "direct", "other"];
const SELF_FUNDED = ["yes", "no", "any"];
const DENIAL_CATEGORY = ["medical_necessity", "prior_auth", "out_of_network", "not_covered", "coding_admin",
  "experimental", "timely_filing", "duplicate", "other"];
const DOCUMENT_TYPE = ["denial_letter", "eob", "other"];
const ANCHOR = ["letter_date", "final_internal_denial_date", "service_date"];
const UNIT = ["days", "months", "hours"];
const WHO = ["consumer", "insurer"];
const HELP_KIND = ["CAP", "regulator", "ombudsman", "helpdesk"];
const APPLIES_KEYS = ["state", "plan_source", "self_funded", "denial_category", "emergency", "urgent", "document_type"];
const RULE_KEYS = ["id", "jurisdiction", "category", "title", "summary", "legal_ref", "source_url", "last_verified",
  "applies_if", "deadline", "priority", "why_template", "caveat"];
const HELP_KEYS = ["id", "scope", "name", "kind", "phone", "url", "what_they_do"];
const ADVICE = [/\byou should\b/i, /\byou must\b/i, /\byou will win\b/i, /\bwe recommend\b/i, /\byou need to\b/i];
const MAX_SUMMARY_WORDS = 60;

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const RULES_DIR = resolve(opt("--rules", "./rules"));
const HELP_FILE = resolve(opt("--help", "./help-resources.json"));
const MAX_AGE_DAYS = Number(opt("--max-age", "45"));
const TODAY = opt("--today", null) ? new Date(opt("--today")) : new Date();
const QUIET = args.includes("--quiet");

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- helpers
const isStr = (v, min = 1) => typeof v === "string" && v.trim().length >= min;
const isISODate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const daysBetween = (a, b) => Math.floor((b - a) / 86_400_000);
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const enumList = (where, field, value, allowed) => {
  if (!Array.isArray(value) || value.length === 0) return fail(where, `${field} must be a non-empty array`);
  for (const v of value) if (!allowed.includes(v)) fail(where, `${field} has unknown value "${v}"`);
};
const readJSON = (file) => {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { fail(file, `not valid JSON (${e.message})`); return null; }
};

// ---------------------------------------------------------------- rules
function validateRule(rule, where, expectedJurisdiction) {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) return fail(where, "rule must be an object");
  for (const k of Object.keys(rule)) if (!RULE_KEYS.includes(k)) fail(where, `unknown field "${k}"`);

  if (!isStr(rule.id) || !/^[a-z]+(\.[a-z0-9_]+)+$/.test(rule.id)) fail(where, `id must look like xx.topic.detail (got ${JSON.stringify(rule.id)})`);
  if (rule.jurisdiction !== expectedJurisdiction) fail(where, `jurisdiction "${rule.jurisdiction}" does not match file (expected "${expectedJurisdiction}")`);
  if (!CATEGORY.includes(rule.category)) fail(where, `category must be one of ${CATEGORY.join("|")}`);
  if (!isStr(rule.title, 4)) fail(where, "title missing or too short");
  if (!isStr(rule.summary, 20)) fail(where, "summary missing or too short (min 20 chars)");
  else {
    const n = words(rule.summary);
    if (n > MAX_SUMMARY_WORDS) fail(where, `summary is ${n} words (max ${MAX_SUMMARY_WORDS})`);
    for (const re of ADVICE) if (re.test(rule.summary)) fail(where, `summary contains advice language (${re.source})`);
  }
  if (!isStr(rule.legal_ref, 3)) fail(where, "legal_ref missing");
  if (!isStr(rule.source_url) || !/^https:\/\/[^\s]+$/.test(rule.source_url)) fail(where, "source_url must be an https URL");
  else { try { new URL(rule.source_url); } catch { fail(where, "source_url is not a valid URL"); } }

  if (!isISODate(rule.last_verified)) fail(where, `last_verified must be an ISO date YYYY-MM-DD (got ${JSON.stringify(rule.last_verified)})`);
  else {
    const age = daysBetween(new Date(rule.last_verified), TODAY);
    if (age < 0) fail(where, `last_verified ${rule.last_verified} is in the future`);
    else if (age > MAX_AGE_DAYS) fail(where, `last_verified ${rule.last_verified} is ${age} days old (max ${MAX_AGE_DAYS}); re-read the source and update the date`);
  }

  const a = rule.applies_if;
  if (typeof a !== "object" || a === null || Array.isArray(a)) fail(where, "applies_if must be an object (use {} for 'always')");
  else {
    for (const k of Object.keys(a)) if (!APPLIES_KEYS.includes(k)) fail(where, `applies_if has unknown key "${k}"`);
    if ("state" in a) enumList(where, "applies_if.state", a.state, US_STATES);
    if ("plan_source" in a) enumList(where, "applies_if.plan_source", a.plan_source, PLAN_SOURCE);
    if ("self_funded" in a && !SELF_FUNDED.includes(a.self_funded)) fail(where, `applies_if.self_funded must be ${SELF_FUNDED.join("|")}`);
    if ("denial_category" in a) enumList(where, "applies_if.denial_category", a.denial_category, DENIAL_CATEGORY);
    if ("document_type" in a) enumList(where, "applies_if.document_type", a.document_type, DOCUMENT_TYPE);
    for (const b of ["emergency", "urgent"]) if (b in a && typeof a[b] !== "boolean") fail(where, `applies_if.${b} must be boolean`);
    if (/^[A-Z]{2}$/.test(expectedJurisdiction)) {
      if (!Array.isArray(a.state) || !a.state.includes(expectedJurisdiction)) fail(where, `state rule must list "${expectedJurisdiction}" in applies_if.state`);
      if (a.self_funded !== "no" && a.self_funded !== "any") fail(where, `state rule should set applies_if.self_funded to "no" (state law reaches insured plans only) or "any" with a justification in caveat`);
    }
  }

  if ("deadline" in rule) {
    const d = rule.deadline;
    if (typeof d !== "object" || d === null) fail(where, "deadline must be an object");
    else {
      for (const k of Object.keys(d)) if (!["anchor", "amount", "unit", "who"].includes(k)) fail(where, `deadline has unknown key "${k}"`);
      if (!ANCHOR.includes(d.anchor)) fail(where, `deadline.anchor must be ${ANCHOR.join("|")}`);
      if (typeof d.amount !== "number" || !(d.amount > 0)) fail(where, "deadline.amount must be a positive number");
      if (!UNIT.includes(d.unit)) fail(where, `deadline.unit must be ${UNIT.join("|")}`);
      if (!WHO.includes(d.who)) fail(where, `deadline.who must be ${WHO.join("|")}`);
      if (rule.category !== "deadline" && d.who === "consumer") fail(where, `a consumer deadline should have category "deadline"`);
    }
  } else if (rule.category === "deadline") fail(where, `category "deadline" requires a deadline block`);

  if (!Number.isInteger(rule.priority) || rule.priority < 0) fail(where, "priority must be a non-negative integer");
  if (!isStr(rule.why_template, 10)) fail(where, "why_template missing or too short");
  if ("caveat" in rule && !isStr(rule.caveat)) fail(where, "caveat, if present, must be a non-empty string");
}

function jurisdictionFor(file) {
  const stem = basename(file, ".json");
  if (stem === "federal" || stem === "nsa") return stem;
  if (/^[a-z]{2}$/.test(stem)) return stem.toUpperCase();
  fail(file, "file name must be federal.json, nsa.json or a two-letter state code like tx.json");
  return null;
}

let ruleFiles = [];
try { ruleFiles = readdirSync(RULES_DIR).filter((f) => f.endsWith(".json")).sort(); }
catch { fail(RULES_DIR, "rules directory not found"); }
if (ruleFiles.length === 0) fail(RULES_DIR, "no rule files");

const ids = new Map();
const statesWithRules = new Set();
let ruleCount = 0;

for (const f of ruleFiles) {
  const file = join(RULES_DIR, f);
  const jur = jurisdictionFor(file);
  if (!jur) continue;
  const data = readJSON(file);
  if (data === null) continue;
  if (!Array.isArray(data)) { fail(file, "must be a JSON array of rules"); continue; }
  if (data.length === 0) fail(file, "empty rule file");
  data.forEach((rule, i) => {
    const where = `${f}[${i}]${rule && rule.id ? ` ${rule.id}` : ""}`;
    validateRule(rule, where, jur);
    if (rule && typeof rule.id === "string") {
      if (ids.has(rule.id)) fail(where, `duplicate id (also in ${ids.get(rule.id)})`);
      else ids.set(rule.id, f);
      if (!rule.id.startsWith(jur.toLowerCase() + ".") && !(jur === "federal" && rule.id.startsWith("fed."))) {
        fail(where, `id should start with "${jur === "federal" ? "fed" : jur.toLowerCase()}."`);
      }
    }
    ruleCount++;
  });
  if (/^[A-Z]{2}$/.test(jur)) statesWithRules.add(jur);
}

// ---------------------------------------------------------------- help resources
let helpCount = 0;
const helpScopes = new Set();
let help = null;
try { statSync(HELP_FILE); help = readJSON(HELP_FILE); } catch { fail(HELP_FILE, "help-resources file not found"); }
if (help !== null) {
  if (!Array.isArray(help)) fail(HELP_FILE, "must be a JSON array");
  else {
    const helpIds = new Set();
    help.forEach((h, i) => {
      const where = `help-resources[${i}]${h && h.id ? ` ${h.id}` : ""}`;
      if (typeof h !== "object" || h === null) return fail(where, "entry must be an object");
      for (const k of Object.keys(h)) if (!HELP_KEYS.includes(k)) fail(where, `unknown field "${k}"`);
      if (!isStr(h.id)) fail(where, "id missing"); else if (helpIds.has(h.id)) fail(where, "duplicate id"); else helpIds.add(h.id);
      if (h.scope !== "federal" && !US_STATES.includes(h.scope)) fail(where, `scope must be "federal" or a state code`);
      if (!isStr(h.name)) fail(where, "name missing");
      if (!HELP_KIND.includes(h.kind)) fail(where, `kind must be ${HELP_KIND.join("|")}`);
      if ("phone" in h && !isStr(h.phone)) fail(where, "phone, if present, must be a non-empty string");
      if (!isStr(h.url) || !/^https:\/\//.test(h.url)) fail(where, "url must be https");
      if (!isStr(h.what_they_do, 10)) fail(where, "what_they_do missing or too short");
      if (h.scope) helpScopes.add(h.scope);
      helpCount++;
    });
    if (!helpScopes.has("federal")) fail(HELP_FILE, "needs at least one federal entry (the fallback for unsupported states)");
    for (const s of statesWithRules) if (!helpScopes.has(s)) fail(HELP_FILE, `state ${s} has rules but no help entry — every state needs a human to call`);
  }
}

// ---------------------------------------------------------------- report
if (problems.length) {
  console.error(`✗ ${problems.length} problem${problems.length > 1 ? "s" : ""}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
if (!QUIET) {
  console.log(`✓ ${ruleCount} rules in ${ruleFiles.length} files (${[...statesWithRules].sort().join(", ") || "no states"} + federal/nsa), ` +
    `${helpCount} help resources, all sources https, all verified within ${MAX_AGE_DAYS} days of ${TODAY.toISOString().slice(0, 10)}`);
}
