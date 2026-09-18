import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, WRITE_EFFORT } from "./client";
import { DRAFT_SYSTEM, draftUser } from "./prompts/draft";
import { findCitations, findPlaceholders, findPrescriptive, stripUnknownCitations, unknownCitations } from "./guard";
import type { RightsResult } from "@/lib/rules/engine";
import { LetterDraft, LetterModelSchema, SECTION_IDS, type LetterModel } from "@/lib/schemas/letter";
import type { Situation } from "@/lib/schemas/situation";

/**
 * Draft the letter, then enforce the guard:
 *  1. citations must be a subset of the computed rights (unknown ones are stripped);
 *  2. no advice-style phrasing; one corrective regeneration, then report what remains;
 *  3. placeholders are extracted so the UI can list what the user still has to add.
 */
export async function draftLetter(s: Situation, r: RightsResult): Promise<{ draft: LetterDraft; usage: { input: number; output: number } }> {
  const client = anthropic();
  const allowed = new Set(r.rules.map((a) => a.rule.id));
  const user = draftUser(s, r);
  const usage = { input: 0, output: 0 };

  const ask = async (extra?: string): Promise<LetterModel | null> => {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      system: DRAFT_SYSTEM,
      output_config: { effort: WRITE_EFFORT, format: zodOutputFormat(LetterModelSchema) },
      messages: [{ role: "user", content: extra ? `${user}\n\n${extra}` : user }],
    });
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    return res.parsed_output;
  };

  let m = await ask();
  if (!m) throw new Error("draft: no parsable output");

  const fullText = (x: LetterModel) => x.sections.map((sec) => sec.text).join("\n\n");
  let hits = findPrescriptive(fullText(m));
  let unknown = unknownCitations(fullText(m), allowed);
  let regenerated = false;

  if (hits.length || unknown.length) {
    const notes: string[] = [];
    if (hits.length) notes.push(`it contained advice-style phrasing (${hits.join(", ")}); the letter speaks to the plan, never to the patient`);
    if (unknown.length) notes.push(`it cited rule ids that are not in the input (${unknown.join(", ")}); cite only the ids listed`);
    const second = await ask(`Your previous draft had problems: ${notes.join("; ")}. Rewrite the whole letter with the same facts and rules.`);
    if (second) {
      m = second;
      regenerated = true;
      hits = findPrescriptive(fullText(m));
      unknown = unknownCitations(fullText(m), allowed);
    }
  }

  // Keep sections in canonical order, one each; strip citations we cannot back.
  const byId = new Map(m.sections.map((sec) => [sec.id, sec]));
  const sections = SECTION_IDS.filter((id) => byId.has(id)).map((id) => {
    const sec = byId.get(id)!;
    return { id, heading: sec.heading || undefined, text: stripUnknownCitations(sec.text, allowed).replace(/[ \t]+\n/g, "\n") };
  });
  const text = sections.map((sec) => sec.text).join("\n\n");

  const address = s.extraction.stated_appeal_address.value;
  const draft = LetterDraft.parse({
    sections,
    placeholders: findPlaceholders(text),
    cited_rule_ids: Array.from(new Set(findCitations(text))),
    checklist: m.checklist,
    send_to: {
      address,
      source: address ? "letter" : "generic",
      verify_note: address
        ? "This address was read from your document. Check it against the original before sending."
        : "Your document does not name an appeals address. Call the member services number on your insurance card and ask where written appeals go, or check the plan's website.",
    },
    guard_report: { prescriptive_hits: hits, unknown_citations: unknown, regenerated },
  });

  return { draft, usage };
}
