import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isModelDown, isRateLimit, LIVE_UPLOADS_ENABLED, MODEL } from "@/lib/ai/client";
import { draftLetter } from "@/lib/ai/draft";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { checkRateLimit, clientIp } from "@/lib/server/ratelimit";
import { DEFAULT_SAMPLE_ANSWERS, sampleById } from "@/lib/samples";
import { Situation } from "@/lib/schemas/situation";
import type { LetterDraft } from "@/lib/schemas/letter";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ situation: Situation, sample_id: z.string().optional() });

const fail = (status: number, code: string, message: string) => NextResponse.json({ code, message }, { status });

/**
 * POST /api/draft — situation in, letter out. Rights are recomputed here from the same
 * deterministic engine the browser used, so the model can only cite what the code decided.
 * Samples with the default answers return a cached letter; anything else calls the model.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "The request did not match what Overturn expects.");
  const { situation, sample_id } = parsed.data;

  const rights = computeRights(situation, ALL_RULES, HELP_RESOURCES);

  if (sample_id) {
    const sample = sampleById(sample_id);
    if (sample && sampleAnswersAreDefault(situation, sample_id)) {
      try {
        const cached = JSON.parse(await readFile(path.join(process.cwd(), "data", "samples", `${sample.id}.letter.json`), "utf8")) as LetterDraft;
        return NextResponse.json({ draft: cached, meta: { model: MODEL, ms: Date.now() - started, cached: true } });
      } catch {
        /* no cached letter for these answers: fall through to the model */
      }
    }
  }

  if (!LIVE_UPLOADS_ENABLED) return fail(503, "uploads_paused", "Live drafting is paused right now. The sample letters still work.");
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) return fail(429, "rate_limited", `Too many requests from this connection. Try again in about ${Math.ceil(rl.retry_after_s / 60)} minutes.`);

  try {
    const { draft, usage } = await draftLetter(situation, rights);
    console.info(`[draft] ok ${Date.now() - started}ms in=${usage.input} out=${usage.output}`);
    return NextResponse.json({ draft, meta: { model: MODEL, ms: Date.now() - started, cached: false } });
  } catch (err) {
    if (isRateLimit(err)) return fail(429, "rate_limited", "The writing service is busy. Please try again in a minute.");
    if (isModelDown(err)) return fail(503, "model_unavailable", "The writing service is unavailable right now.");
    console.error(`[draft] error ${(err as Error).name}`);
    return fail(500, "internal", "Something went wrong while drafting the letter.");
  }
}

function sampleAnswersAreDefault(s: Situation, id: string): boolean {
  const d = DEFAULT_SAMPLE_ANSWERS[id];
  if (!d) return false;
  const sample = sampleById(id);
  return (
    !!sample &&
    s.state === sample.state &&
    s.plan_source === d.plan_source &&
    s.self_funded === d.self_funded &&
    s.emergency === d.emergency &&
    s.urgent === d.urgent &&
    !s.anchor_dates.final_internal_denial_date
  );
}
