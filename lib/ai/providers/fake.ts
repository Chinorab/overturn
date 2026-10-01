import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  UnsupportedInputError,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
  type Task,
} from "../provider";
import { Explanation, Extraction, toModel } from "@/lib/schemas/extraction";
import { LetterDraft } from "@/lib/schemas/letter";

/**
 * A provider that answers from the golden samples in `data/samples/`.
 *
 * It exists so the whole pipeline — extract, explain, draft — can be exercised offline,
 * deterministically, and for free: `pnpm test` runs on it. It is never a fallback for a real
 * call; selecting it is explicit,
 * through `OVERTURN_LLM_PROVIDER=fake`.
 *
 * It answers with a *model-shaped* value, not with the strict one, so the real validation,
 * readability gate and citation guard downstream run for real rather than being skipped.
 */
export class FakeProvider implements LLMProvider {
  readonly id = "fake";

  modelFor(_task: Task): string {
    return "fake";
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const usage = { input: 0, output: 0 };
    const sample = pickSample(req);

    switch (req.schemaName) {
      case "Extraction":
        return { value: req.schema.parse(toModel(extractionOf(sample))) as T, usage };
      case "Explanation": {
        const { summary, terms } = explanationOf(sample);
        return { value: req.schema.parse({ summary, terms }) as T, usage };
      }
      case "Letter": {
        const draft = letterOf(sample);
        const sections = draft.sections.map((s) => ({ id: s.id, heading: s.heading ?? "", text: s.text }));
        return { value: req.schema.parse({ sections, checklist: draft.checklist }) as T, usage };
      }
      default:
        throw new UnsupportedInputError(`fake provider has no golden answer for schema "${req.schemaName}"`);
    }
  }
}

/* -------------------------------------------------------------------------- samples */

const DIR = join(process.cwd(), "data", "samples");
const DEFAULT_SAMPLE = process.env.OVERTURN_FAKE_SAMPLE ?? "02-prior-auth-ca";

const read = <T>(id: string, kind: string, schema: { parse: (x: unknown) => T }): T =>
  schema.parse(JSON.parse(readFileSync(join(DIR, `${id}.${kind}.json`), "utf8")));

const extractionOf = (id: string) => read(id, "extraction", Extraction);
const explanationOf = (id: string) => read(id, "explain", Explanation);
const letterOf = (id: string) => read(id, "letter", LetterDraft);

let ids: string[] | null = null;
function sampleIds(): string[] {
  ids ??= readdirSync(DIR)
    .filter((f) => f.endsWith(".extraction.json"))
    .map((f) => f.replace(".extraction.json", ""))
    .sort();
  return ids;
}

/**
 * Which sample is this call about?
 *
 * The extraction step has only a document, which carries no id we can trust, so it uses
 * `OVERTURN_FAKE_SAMPLE`. The later steps quote the extracted facts in their prompt, so the
 * claim number — unique across the samples — identifies them exactly. Guessing is not allowed:
 * a prompt that matches no sample falls back to the configured one rather than to the nearest.
 */
function pickSample<T>(req: StructuredRequest<T>): string {
  if (req.task === "extract") return DEFAULT_SAMPLE;
  for (const id of sampleIds()) {
    const claim = extractionOf(id).claim_number.value;
    if (claim && req.user.includes(claim)) return id;
  }
  return DEFAULT_SAMPLE;
}
