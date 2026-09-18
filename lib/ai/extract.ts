import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, EXTRACT_EFFORT, MODEL } from "./client";
import { EXTRACT_SYSTEM, EXTRACT_USER } from "./prompts/extract";
import { Extraction, ExtractionModelSchema } from "@/lib/schemas/extraction";

export type DocumentInput =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; media_type: "image/jpeg" | "image/png"; base64: string };

export class ExtractionInvalidError extends Error {
  code = "extraction_invalid" as const;
}

/**
 * One model call: document in, structured facts out. The strict schema is applied after
 * the model-facing one; if the model returns an out-of-range confidence or a malformed
 * date we clamp what we safely can and reject the rest.
 */
export async function extractDocument(doc: DocumentInput): Promise<{ extraction: Extraction; usage: { input: number; output: number } }> {
  const client = anthropic();

  const block =
    doc.kind === "pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: doc.media_type, data: doc.base64 } };

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: EXTRACT_SYSTEM,
    output_config: { effort: EXTRACT_EFFORT, format: zodOutputFormat(ExtractionModelSchema) },
    messages: [{ role: "user", content: [block, { type: "text", text: EXTRACT_USER }] }],
  });

  const raw = response.parsed_output;
  if (!raw) throw new ExtractionInvalidError("model returned no parsable output");

  const strict = Extraction.safeParse(normalise(raw));
  if (!strict.success) throw new ExtractionInvalidError(strict.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  return {
    extraction: strict.data,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}

/** Clamp confidences to [0,1] and null out any date that is not YYYY-MM-DD. */
function normalise(raw: unknown): unknown {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const fix = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === "object") {
      const o = { ...(v as Record<string, unknown>) };
      if (typeof o.confidence === "number") o.confidence = Math.min(1, Math.max(0, o.confidence));
      if ("value" in o && "confidence" in o) {
        const val = o.value;
        if (typeof val === "string" && looksLikeDateField(val) && !iso.test(val)) o.value = null;
        if (Array.isArray(val) && val.every((x) => typeof x === "string" && looksLikeDateField(x))) {
          o.value = val.filter((x) => iso.test(x as string));
        }
        if (val && typeof val === "object" && "kind" in (val as object) && (val as { kind: string }).kind === "date") {
          const d = (val as { date: string }).date;
          if (!iso.test(d)) o.value = null;
        }
      }
      for (const k of Object.keys(o)) if (k !== "value") o[k] = fix(o[k]);
      return o;
    }
    return v;
  };
  return fix(raw);
}

const looksLikeDateField = (s: string) => /^\d{4}-\d{2}(-\d{2})?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s);
