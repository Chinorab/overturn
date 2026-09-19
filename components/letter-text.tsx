import { Fragment } from "react";
import { ALL_RULES } from "@/lib/rules/load";

/**
 * Renders letter text for reading: [ADD: …] becomes a highlighted chip, [[cite:id]]
 * becomes a small superscript reference to the rule's legal citation. For the
 * downloadable versions, see `letterToPlainText` (citations become footnotes).
 */
export function LetterRichText({ text, numbering }: { text: string; numbering?: string[] }) {
  const parts = text.split(/(\[ADD:[^\]]+\]|\[\[cite:[a-z0-9_.]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("[ADD:")) return <mark key={i} className="placeholder-chip">{p}</mark>;
        const m = p.match(/^\[\[cite:([a-z0-9_.]+)\]\]$/);
        if (m) {
          const rule = ALL_RULES.find((r) => r.id === m[1]);
          // On screen a footnote number keeps the sentence readable; the numbered reference list below spells it out.
          const n = numbering ? numbering.indexOf(m[1]) + 1 : 0;
          const label = rule ? `${rule.title} — ${rule.legal_ref}` : m[1];
          return (
            <sup key={i} className="ml-0.5 font-sans text-[0.7em] font-medium text-primary" title={label}>
              {n > 0 ? `[${n}]` : `[${rule ? rule.legal_ref : m[1]}]`}
              <span className="sr-only"> (reference{n > 0 ? ` ${n}` : ""}: {label})</span>
            </sup>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Plain text with citations rendered inline as legal references, for copy and PDF. */
export function letterToPlainText(sections: Array<{ heading?: string; text: string }>): string {
  const cite = (t: string) =>
    t.replace(/\s*\[\[cite:([a-z0-9_.]+)\]\]/g, (_m, id: string) => {
      const rule = ALL_RULES.find((r) => r.id === id);
      return rule ? ` (${rule.legal_ref})` : "";
    });
  return sections.map((s) => (s.heading ? `${s.heading}\n\n` : "") + cite(s.text)).join("\n\n");
}

export function citedRules(sections: Array<{ text: string }>) {
  const ids = Array.from(new Set(sections.flatMap((s) => Array.from(s.text.matchAll(/\[\[cite:([a-z0-9_.]+)\]\]/g), (m) => m[1]))));
  return ids.map((id) => ALL_RULES.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}
