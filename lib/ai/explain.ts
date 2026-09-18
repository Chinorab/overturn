import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, WRITE_EFFORT } from "./client";
import { EXPLAIN_SYSTEM, explainUser } from "./prompts/explain";
import { findPrescriptive } from "./guard";
import { fleschKincaidGrade, wordCount } from "@/lib/readability";
import { GLOSSARY } from "@/lib/rules/load";
import { Explanation, ExplanationModelSchema, type Extraction } from "@/lib/schemas/extraction";

export const MAX_GRADE = 8;
export const MAX_WORDS = 120;

/**
 * Plain-English explanation with a readability gate: if the first draft reads above
 * grade 8, is too long, or slips into prescriptive language, ask once for a simpler
 * rewrite. The second draft ships regardless, with its measured grade attached.
 */
export async function explainExtraction(ex: Extraction): Promise<{ explanation: Explanation; usage: { input: number; output: number }; regenerated: boolean }> {
  const client = anthropic();
  const user = explainUser(ex, GLOSSARY);
  const usage = { input: 0, output: 0 };

  const ask = async (extra?: string) => {
    const r = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: EXPLAIN_SYSTEM,
      output_config: { effort: WRITE_EFFORT, format: zodOutputFormat(ExplanationModelSchema) },
      messages: [{ role: "user", content: extra ? `${user}\n\n${extra}` : user }],
    });
    usage.input += r.usage.input_tokens;
    usage.output += r.usage.output_tokens;
    return r.parsed_output;
  };

  let draft = await ask();
  if (!draft) throw new Error("explanation: no parsable output");
  let regenerated = false;

  const problems = (d: { summary: string }) => {
    const p: string[] = [];
    const grade = fleschKincaidGrade(d.summary);
    if (grade > MAX_GRADE) p.push(`reads at grade ${grade}; use shorter sentences and simpler words`);
    if (wordCount(d.summary) > MAX_WORDS) p.push(`is ${wordCount(d.summary)} words; cut it to ${MAX_WORDS - 20} words or fewer by dropping the least important details`);
    const hits = findPrescriptive(d.summary);
    if (hits.length) p.push(`contains advice-like phrasing (${hits.join(", ")}); describe, do not instruct`);
    return p;
  };

  // Up to two corrective passes; the last draft ships regardless, with its measured grade.
  for (let attempt = 0; attempt < 2; attempt++) {
    const issues = problems(draft);
    if (!issues.length) break;
    const next = await ask(`Your previous summary ${issues.join("; ")}. Rewrite it. Same facts, same rules.

Previous summary:
${draft.summary}`);
    if (!next) break;
    draft = next;
    regenerated = true;
  }

  const explanation = Explanation.parse({ ...draft, grade_level: fleschKincaidGrade(draft.summary) });
  return { explanation, usage, regenerated };
}
