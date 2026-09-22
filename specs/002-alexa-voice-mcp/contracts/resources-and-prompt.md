# Resources and the voice prompt — executable contract (T014)

What an assistant can read from the server without running a case, and the persona every client
receives over MCP instead of writing its own.

**Run on 2026-09-22** against the real rules dataset, help resources, glossary and the seven
sample files: 31 assertions pass, and every sample line is checked through `turn-check` as a
spoken offer.

## Resources

| URI | What it is | Why an assistant would read it |
|---|---|---|
| `overturn://samples` | The seven bundled documents: id, title, state, document type, denial category, **supported** flag and a one-line spoken offer | To propose a sample when the person has no letter, or for a demo — without guessing what the samples contain |
| `overturn://rules/{federal,nsa,ca,ny,tx}` | Every rule of that file with its legal reference, primary source, last-verified date, `applies_if` and deadline, plus `ruleCount` and `oldestVerification` | To show provenance, or to answer "where does that come from?" — **not** to decide what applies |
| `overturn://help` | Consumer Assistance Programs, regulators, help desks | The human fallback, available even outside a case |
| `overturn://glossary` | Plain-English definitions | To explain a term the person asks about |

Each rules view carries a note that says plainly: *applicability is decided by
`overturn_compute_rights`, not by reading this list; `applies_if` conditions are ANDed and depend
on answers the person gives.* Without it, a capable model reading the dataset would happily decide
for itself which rules apply — the exact thing the architecture exists to prevent.

The tests assert: every rule in every view has an `https` source and a verification date; the five
views together contain exactly as many rules as `ALL_RULES`; ids are unique per file; every
resource is valid JSON with a description long enough to be useful to an orchestrator; and **no
email address appears anywhere in any resource**.

## The spoken sample offer

`spokenSample()` uses the same reason wording as a read-back, so a person hears one voice
throughout: *"a denial letter from California, denied because prior authorization wasn't
obtained"*, *"an explanation of benefits from Texas, denied because the provider was out of
network"*, and for the Medicare file *"a denial letter from Texas that I don't cover, to show what
happens then"*. Each one is checked as a complete turn (`For example, …. Which would you like?`).

A first draft read *"a denial letter for prior authorization missing, in CA"* — the category label
from the UI, and a state code spoken as two letters. Both were replaced: the reason map is the
speech one, and `STATE_NAME` (added to `answers.ts`, inverted from the recogniser's own table)
gives the name a person says.

## The prompt

`overturn_voice_persona` is read from `mcp/prompts/overturn_voice_persona.md` at call time, so the
file the team edits is the file clients receive. The optional `simulated` argument appends a short
paragraph telling the assistant it is in an unofficial simulation and must not claim to be a
device or an Amazon product — the simulator passes it, a real Alexa+ would not.

The tests assert the prompt still contains the things the design depends on: the
information-not-advice line, "one question per turn", the 60-word limit, the `confirmed: true`
protocol, and the rule against speaking a number that did not come from a tool. If someone edits
the persona and drops one of those, the build fails.

## A bug worth recording

The state-name table was first built with a regex that a shell heredoc had corrupted: `\b` was
written into the file as a literal backspace byte (`\x08`), so the expression never matched and
every state came out lowercase — "a denial letter from california". The test caught it; the fix
replaced the regex with an explicit split-and-capitalise, and the generator now asserts no control
characters remain. Worth remembering for the build days: **generate code with a script file, not a
heredoc.**

## `mcp/src/resources.ts`

```ts
/**
 * MCP resources and prompts. Resources are read-only views an assistant can pull without running
 * a case: what samples exist, and what the rules dataset says. The prompt is the voice persona,
 * served over MCP so every client — the simulator, MCP Inspector, a future Alexa+ — gets the same
 * instructions instead of each one inventing its own.
 */
import { readFileSync } from "node:fs";
import { RULE_FILES, HELP_RESOURCES, GLOSSARY } from "@/lib/rules/load";
import type { Rule } from "@/lib/rules/schema";
import type { USStateCode } from "@/lib/schemas/core";
import { STATE_NAME } from "./answers";
import type { Extraction } from "@/lib/schemas/extraction";

export const JURISDICTIONS = ["federal", "nsa", "ca", "ny", "tx"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

// ---------------------------------------------------------------- overturn://samples
export type SampleEntry = {
  id: string;
  title: string;
  state: USStateCode | null;
  documentType: "denial_letter" | "eob" | "other";
  denialCategory: string;
  supported: boolean;
  spoken: string;
};

/** One line an assistant can read aloud when offering a sample. Same reason wording as a read-back. */
export function spokenSample(e: Omit<SampleEntry, "spoken">): string {
  const what = e.documentType === "eob" ? "an explanation of benefits" : "a denial letter";
  const where = e.state ? ` from ${STATE_NAME[e.state] ?? e.state}` : "";
  if (!e.supported) return `${what}${where} that I don't cover, to show what happens then`;
  const why = SAMPLE_REASON[e.denialCategory] ?? "for another reason";
  return `${what}${where}, ${why}`;
}

/** Spoken reason per category, in the same voice as readback.ts. */
const SAMPLE_REASON: Record<string, string> = {
  medical_necessity: "denied as not medically necessary",
  prior_auth: "denied because prior authorization wasn't obtained",
  out_of_network: "denied because the provider was out of network",
  not_covered: "denied as not a covered benefit",
  coding_admin: "denied over a coding or paperwork problem",
  experimental: "denied as experimental",
  timely_filing: "denied because the claim was filed too late",
  duplicate: "denied as a duplicate claim",
  other: "denied for another reason",
};

/** Build the catalogue from the sample files on disk. Pure given `read`. */
export function buildSampleCatalogue(ids: string[], read: (id: string) => { extraction?: Extraction; title?: string; unsupported?: boolean }): SampleEntry[] {
  return ids.map((id) => {
    const s = read(id);
    const base = {
      id,
      title: s.title ?? id,
      state: (s.extraction?.state_hint.value ?? null) as USStateCode | null,
      documentType: (s.extraction?.document_type.value ?? "other") as SampleEntry["documentType"],
      denialCategory: s.extraction?.denial_category.value ?? "other",
      supported: !s.unsupported,
    };
    return { ...base, spoken: spokenSample(base) };
  });
}

export const samplesResource = (entries: SampleEntry[]) => ({
  uri: "overturn://samples",
  name: "Bundled sample documents",
  description: "Synthetic denial letters and EOBs a client can use instead of a real upload. Call overturn_use_sample with one of these ids.",
  mimeType: "application/json",
  text: JSON.stringify(entries, null, 1),
});

// ---------------------------------------------------------------- overturn://rules/{jurisdiction}
export type RulesView = {
  jurisdiction: Jurisdiction;
  version: string;
  ruleCount: number;
  oldestVerification: string;
  rules: Pick<Rule, "id" | "category" | "title" | "summary" | "legal_ref" | "source_url" | "last_verified" | "applies_if" | "deadline" | "priority">[];
  note: string;
};

const RULES_NOTE =
  "Read-only view of the rules dataset the engine uses. Which rules apply to a person is decided by " +
  "overturn_compute_rights, not by reading this list: applies_if conditions are ANDed and depend on answers " +
  "the person gives. Every rule carries the primary source a human read and the date they read it.";

export function rulesView(j: Jurisdiction, version: string): RulesView {
  const rules = RULE_FILES[j] as unknown as Rule[];
  return {
    jurisdiction: j,
    version,
    ruleCount: rules.length,
    oldestVerification: rules.map((r) => r.last_verified).sort()[0],
    rules: rules.map(({ id, category, title, summary, legal_ref, source_url, last_verified, applies_if, deadline, priority }) =>
      ({ id, category, title, summary, legal_ref, source_url, last_verified, applies_if, deadline, priority })),
    note: RULES_NOTE,
  };
}

export const rulesResource = (j: Jurisdiction, version: string) => ({
  uri: `overturn://rules/${j}`,
  name: `Appeal rules: ${j}`,
  description: `The ${j === "nsa" ? "No Surprises Act" : j === "federal" ? "federal ACA and ERISA" : j.toUpperCase()} rules, each with its legal reference, primary source and last-verified date.`,
  mimeType: "application/json",
  text: JSON.stringify(rulesView(j, version), null, 1),
});

/** overturn://help — the free human help the assistant can always fall back to. */
export const helpResource = () => ({
  uri: "overturn://help",
  name: "Free human help",
  description: "Consumer Assistance Programs, regulators and help desks, per state and federal.",
  mimeType: "application/json",
  text: JSON.stringify(HELP_RESOURCES, null, 1),
});

/** overturn://glossary — plain-English definitions, for a client that wants to explain a term. */
export const glossaryResource = () => ({
  uri: "overturn://glossary",
  name: "Plain-English glossary",
  description: "Definitions for insurance terms, at an eighth-grade reading level.",
  mimeType: "application/json",
  text: JSON.stringify(GLOSSARY, null, 1),
});

export function allResources(entries: SampleEntry[], version: string) {
  return [samplesResource(entries), helpResource(), glossaryResource(), ...JURISDICTIONS.map((j) => rulesResource(j, version))];
}

// ---------------------------------------------------------------- prompts
export type PromptDef = { name: string; description: string; arguments: { name: string; description: string; required: boolean }[]; text: string };

/** The persona, read from disk so the file the team edits is the file clients receive. */
export function voicePersonaPrompt(read: () => string, opts: { simulated?: boolean } = {}): PromptDef {
  const base = read().trim();
  const sim = opts.simulated
    ? "\n\n## This client\n\nYou are running in an unofficial simulation of Alexa+, in a web page. Say so if the person asks what you are. Do not claim to be a device, an Amazon product, or a real Alexa."
    : "";
  return {
    name: "overturn_voice_persona",
    description: "System prompt for an assistant driving these tools by voice: one question per turn, ≤ 60 words, read back before relying, explicit yes before drafting or sending, never rephrase a deadline or a source.",
    arguments: [{ name: "simulated", description: "Set when the client is a simulation rather than a real assistant surface.", required: false }],
    text: base + sim,
  };
}

export const promptMessages = (p: PromptDef) => [{ role: "user" as const, content: { type: "text" as const, text: p.text } }];
```

## Added to `lib/voice/answers.ts`

```ts
/** Code → the name a person says, for speech. Built from the same table, longest name wins. */
export const STATE_NAME: Record<string, string> = Object.entries(STATE_NAMES).reduce((acc, [name, code]) => {
  const pretty = name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!acc[code] || pretty.length > acc[code].length) acc[code] = pretty;
  return acc;
}, {} as Record<string, string>);
```

## Tests (`tests/mcp/resources.test.ts`)

```ts
import { readFileSync, existsSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { ALL_RULES } from "@/lib/rules/load";
import { buildSampleCatalogue, allResources, rulesView, voicePersonaPrompt, promptMessages, JURISDICTIONS, spokenSample } from "./resources";
import { checkTurn } from "@/lib/voice/turn-check";

let fails = 0;
const eq = (label: string, got: any, exp: any) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.log("FAIL", label, "got", JSON.stringify(got), "expected", JSON.stringify(exp)); }
};

const DIR = "D:/claude/overturn/data/samples";
const IDS = ["01-medical-necessity-ny", "02-prior-auth-ca", "03-oon-emergency-tx-eob", "04-not-covered-fl", "05-coding-error-ny-eob", "06-medicare-unsupported", "07-experimental-ca-photo"];
const read = (id: string) => {
  const source = JSON.parse(readFileSync(`${DIR}/${id}.source.json`, "utf8"));
  const exPath = `${DIR}/${id}.extraction.json`;
  return {
    extraction: existsSync(exPath) ? Extraction.parse(JSON.parse(readFileSync(exPath, "utf8"))) : undefined,
    title: source.title,
    unsupported: id.includes("unsupported"),
  };
};

// ---- sample catalogue
const cat = buildSampleCatalogue(IDS, read);
eq("all samples listed", cat.length, 7);
eq("02 entry", { state: cat[1].state, documentType: cat[1].documentType, denialCategory: cat[1].denialCategory, supported: cat[1].supported },
  { state: "CA", documentType: "denial_letter", denialCategory: "prior_auth", supported: true });
eq("02 spoken", cat[1].spoken, "a denial letter from California, denied because prior authorization wasn't obtained");
eq("EOB spoken", cat.find((c) => c.id === "03-oon-emergency-tx-eob")!.spoken, "an explanation of benefits from Texas, denied because the provider was out of network");
eq("unsupported flagged", cat.find((c) => c.id === "06-medicare-unsupported")!.supported, false);
eq("unsupported spoken says so", cat.find((c) => c.id === "06-medicare-unsupported")!.spoken.includes("I don't cover"), true);
eq("every sample has a title", cat.every((c) => c.title.length > 3), true);
// an assistant can read any of these in one short sentence
for (const c of cat) {
  const turn = `For example, ${c.spoken}. Which would you like?`;
  const r = checkTurn(turn);
  if (!r.ok) { fails++; console.log("FAIL sample turn", c.id, r.violations, turn); }
}

// ---- rules resources
const VERSION = "1.0.0";
for (const j of JURISDICTIONS) {
  const v = rulesView(j, VERSION);
  eq(`${j} has rules`, v.ruleCount > 0, true);
  eq(`${j} every rule sourced`, v.rules.every((r) => /^https:\/\//.test(r.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(r.last_verified)), true);
  eq(`${j} oldest verification is a date`, /^\d{4}-\d{2}-\d{2}$/.test(v.oldestVerification), true);
  eq(`${j} note warns against reading applicability`, v.note.includes("decided by"), true);
  // the view must not leak fields the dataset does not have, and must carry every rule of the file
  eq(`${j} ids unique`, new Set(v.rules.map((r) => r.id)).size, v.ruleCount);
}
eq("all jurisdictions total the dataset", JURISDICTIONS.reduce((n, j) => n + rulesView(j, VERSION).ruleCount, 0), ALL_RULES.length);

// ---- resource list
const resources = allResources(cat, VERSION);
eq("resource count", resources.length, 3 + JURISDICTIONS.length);
eq("uris", resources.map((r) => r.uri).slice(0, 3), ["overturn://samples", "overturn://help", "overturn://glossary"]);
eq("every resource has a description for an assistant", resources.every((r) => r.description.length > 30), true);
eq("every resource is valid json", resources.every((r) => { try { JSON.parse(r.text); return true; } catch { return false; } }), true);
eq("samples resource is the catalogue", JSON.parse(resources[0].text).length, 7);
eq("rules resource names its jurisdiction", resources.find((r) => r.uri === "overturn://rules/nsa")!.description.includes("No Surprises Act"), true);
// no personal data anywhere in the resources
eq("no emails in resources", resources.every((r) => !/[\w.+-]+@[\w-]+\.[\w.]+/.test(r.text)), true);

// ---- prompt
const personaFile = "D:/claude/overturn/mcp/prompts/overturn_voice_persona.md";
const p = voicePersonaPrompt(() => readFileSync(personaFile, "utf8"));
eq("prompt name", p.name, "overturn_voice_persona");
eq("prompt states the line", p.text.includes("information, not legal advice"), true);
eq("prompt states one question per turn", /one question per turn/i.test(p.text), true);
eq("prompt states the word limit", /60 words/.test(p.text), true);
eq("prompt states the confirmation protocol", /confirmed: true/.test(p.text), true);
eq("prompt forbids invented numbers", /did not come from a tool/i.test(p.text), true);
eq("no simulation note by default", p.text.includes("unofficial simulation"), false);
const sim = voicePersonaPrompt(() => readFileSync(personaFile, "utf8"), { simulated: true });
eq("simulation note added", sim.text.includes("unofficial simulation of Alexa+"), true);
eq("simulation note is appended, not replacing", sim.text.startsWith(p.text.slice(0, 200)), true);
eq("prompt messages shape", promptMessages(p)[0].content.type, "text");
eq("prompt description mentions the gates", /explicit yes/.test(p.description), true);

console.log(fails ? `${fails} failures` : "all passed");
```
