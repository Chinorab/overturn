import "server-only";
import { getProvider, type DocumentInput } from "./provider";
import { EXTRACT_SYSTEM, EXTRACT_USER } from "./prompts/extract";
import { Extraction, ExtractionModelSchema, fromModel } from "@/lib/schemas/extraction";

export type { DocumentInput };

export class ExtractionInvalidError extends Error {
  code = "extraction_invalid" as const;
}

/**
 * One model call: document in, structured facts out. The strict schema is applied after
 * the model-facing one; if the model returns an out-of-range confidence or a malformed
 * date we clamp what we safely can and reject the rest.
 */
export async function extractDocument(doc: DocumentInput): Promise<{ extraction: Extraction; usage: { input: number; output: number } }> {
  const provider = await getProvider();

  const { value: raw, usage } = await provider.structured({
    task: "extract",
    system: EXTRACT_SYSTEM,
    user: EXTRACT_USER,
    schema: ExtractionModelSchema,
    schemaName: "Extraction",
    maxTokens: 8000,
    document: doc,
  });
  if (!raw) throw new ExtractionInvalidError("model returned no parsable output");

  const strict = Extraction.safeParse(fromModel(raw));
  if (!strict.success) throw new ExtractionInvalidError(strict.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  return { extraction: strict.data, usage };
}
