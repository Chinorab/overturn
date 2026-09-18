import { z } from "zod";

export const SECTION_IDS = ["header", "re", "intro", "facts", "argument", "requests", "closing"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** What the model writes. Small and union-free for structured outputs. */
export const LetterModelSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.enum(SECTION_IDS),
        heading: z.string().describe("Short heading, or empty string for header/closing"),
        text: z.string().describe("Paragraph(s) for this section; use \\n\\n between paragraphs"),
      }),
    )
    .describe("Exactly one entry per section id, in order"),
  checklist: z
    .array(z.object({ item: z.string(), why: z.string() }))
    .describe("Documents to attach or gather before sending, each with a one-line reason"),
});
export type LetterModel = z.infer<typeof LetterModelSchema>;

export const LetterDraft = z.object({
  sections: z.array(z.object({ id: z.enum(SECTION_IDS), heading: z.string().optional(), text: z.string() })),
  placeholders: z.array(z.string()),
  cited_rule_ids: z.array(z.string()),
  checklist: z.array(z.object({ item: z.string(), why: z.string() })),
  send_to: z.object({
    address: z.string().nullable(),
    source: z.enum(["letter", "generic"]),
    verify_note: z.string(),
  }),
  guard_report: z.object({
    prescriptive_hits: z.array(z.string()),
    unknown_citations: z.array(z.string()),
    regenerated: z.boolean(),
  }),
});
export type LetterDraft = z.infer<typeof LetterDraft>;
