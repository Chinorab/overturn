import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isModelDown, isRateLimit, LIVE_UPLOADS_ENABLED, MODEL } from "@/lib/ai/client";
import { explainExtraction } from "@/lib/ai/explain";
import { extractDocument, ExtractionInvalidError, type DocumentInput } from "@/lib/ai/extract";
import { checkRateLimit, clientIp } from "@/lib/server/ratelimit";
import { sampleById } from "@/lib/samples";
import type { Extraction, Explanation } from "@/lib/schemas/extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 20;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

type Fail = { code: string; message: string; resource_url?: string };
const fail = (status: number, body: Fail) => NextResponse.json(body, { status });

const UNSUPPORTED: Record<string, Fail> = {
  medicare: {
    code: "unsupported_program",
    message: "This looks like a Medicare document. Medicare has its own appeal process with different steps and deadlines, and Overturn does not cover it yet. Medicare.gov explains how to file an appeal.",
    resource_url: "https://www.medicare.gov/claims-appeals/how-do-i-file-an-appeal",
  },
  medicaid: {
    code: "unsupported_program",
    message: "This looks like a Medicaid or CHIP document. Those programs use a state fair-hearing process that Overturn does not cover yet. Your state Medicaid agency explains how to appeal.",
    resource_url: "https://www.medicaid.gov/about-us/beneficiary-resources/index.html",
  },
  tricare: {
    code: "unsupported_program",
    message: "This looks like a TRICARE or VA document. Those programs have their own appeal rules that Overturn does not cover yet.",
    resource_url: "https://www.tricare.mil/appeals",
  },
};

/**
 * POST /api/extract — one document in, facts + explanation out. Stateless: the file is
 * read into memory, sent to the model, and dropped. Nothing about its content is logged.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, { code: "bad_request", message: "Expected a form upload." });

  // Samples short-circuit the model entirely.
  const sampleId = form.get("sample_id");
  if (typeof sampleId === "string") {
    const sample = sampleById(sampleId);
    if (!sample) return fail(404, { code: "unknown_sample", message: "That sample does not exist." });
    if (sample.category === "unsupported") return fail(422, UNSUPPORTED.medicare);
    const dir = path.join(process.cwd(), "data", "samples");
    const [extraction, explanation] = await Promise.all([
      readFile(path.join(dir, `${sample.id}.extraction.json`), "utf8").then((s) => JSON.parse(s) as Extraction),
      readFile(path.join(dir, `${sample.id}.explain.json`), "utf8").then((s) => JSON.parse(s) as Explanation),
    ]);
    return NextResponse.json({ extraction, explanation, meta: { model: MODEL, ms: Date.now() - started, cached: true } });
  }

  if (!LIVE_UPLOADS_ENABLED) {
    return fail(503, { code: "uploads_paused", message: "Live uploads are paused right now. The sample documents still work end to end." });
  }

  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) return fail(429, { code: "rate_limited", message: `Too many uploads from this connection. Try again in about ${Math.ceil(rl.retry_after_s / 60)} minutes, or use a sample.` });

  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, { code: "bad_request", message: "No file was uploaded." });
  if (!ALLOWED.has(file.type)) return fail(415, { code: "unsupported_type", message: "Please upload a PDF, JPG, or PNG." });
  if (file.size > MAX_BYTES) return fail(413, { code: "too_large", message: "That file is over 10 MB. Try a smaller scan or a photo of each page." });

  const bytes = Buffer.from(await file.arrayBuffer());
  let doc: DocumentInput;
  if (file.type === "application/pdf") {
    const pages = countPdfPages(bytes);
    if (pages > MAX_PAGES) return fail(413, { code: "too_many_pages", message: `That PDF has about ${pages} pages. Overturn reads up to ${MAX_PAGES}; please upload just the denial letter or EOB.` });
    doc = { kind: "pdf", base64: bytes.toString("base64") };
  } else {
    doc = { kind: "image", media_type: file.type as "image/jpeg" | "image/png", base64: bytes.toString("base64") };
  }

  try {
    const { extraction, usage } = await extractDocument(doc);

    const program = extraction.program_signals;
    if (program.value && program.value in UNSUPPORTED && program.confidence >= 0.6) {
      return fail(422, UNSUPPORTED[program.value]);
    }
    if (extraction.document_type.value === "other" && extraction.document_type.confidence >= 0.6) {
      return fail(422, { code: "not_a_claim_document", message: "This does not look like a denial letter or an Explanation of Benefits. Overturn reads those two kinds of documents." });
    }

    const { explanation, usage: u2 } = await explainExtraction(extraction);
    // Only timing and token counts are logged; never content.
    console.info(`[extract] ok ${Date.now() - started}ms in=${usage.input + u2.input} out=${usage.output + u2.output}`);
    return NextResponse.json({ extraction, explanation, meta: { model: MODEL, ms: Date.now() - started, cached: false } });
  } catch (err) {
    if (err instanceof ExtractionInvalidError) return fail(502, { code: "extraction_invalid", message: "The document was read but the result did not check out. Please try again, or enter the details by hand." });
    if (isRateLimit(err)) return fail(429, { code: "rate_limited", message: "The reading service is busy. Please try again in a minute." });
    if (isModelDown(err)) return fail(503, { code: "model_unavailable", message: "The reading service is unavailable right now. The sample documents still work." });
    console.error(`[extract] error ${(err as Error).name}`);
    return fail(500, { code: "internal", message: "Something went wrong while reading the document." });
  }
}

/** Cheap page estimate: count page objects in the PDF source. Good enough for a cap. */
function countPdfPages(buf: Buffer): number {
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 1;
}
