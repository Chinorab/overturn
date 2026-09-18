"use client";

import { Fragment, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Term = { term: string; definition: string };

/**
 * Renders prose with the explanation's jargon terms underlined (dotted) and defined on
 * tap/hover/focus. Each match is a real button so keyboard and screen-reader users get
 * the definition too. Only the first occurrence of each term is marked, to keep it calm.
 */
export function GlossaryText({ text, terms }: { text: string; terms: Term[] }) {
  const parts = useMemo(() => split(text, terms), [text, terms]);
  return (
    <p className="text-[1.05rem] leading-relaxed">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <Popover key={i}>
            <PopoverTrigger render={<button type="button" className="term rounded-sm px-0.5" />}>{p.text}</PopoverTrigger>
            <PopoverContent className="max-w-xs text-sm leading-snug">
              <span className="font-semibold">{p.term.term}: </span>
              {p.term.definition}
            </PopoverContent>
          </Popover>
        ),
      )}
    </p>
  );
}

function split(text: string, terms: Term[]): Array<string | { text: string; term: Term }> {
  if (!terms.length) return [text];
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  const used = new Set<string>();
  const out: Array<string | { text: string; term: Term }> = [];
  let rest = text;
  while (rest.length) {
    let best: { idx: number; len: number; term: Term } | null = null;
    for (const t of sorted) {
      if (used.has(t.term)) continue;
      const re = new RegExp(`\\b${escape(t.term)}\\b`, "i");
      const m = re.exec(rest);
      if (m && (best === null || m.index < best.idx)) best = { idx: m.index, len: m[0].length, term: t };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push({ text: rest.slice(best.idx, best.idx + best.len), term: best.term });
    used.add(best.term.term);
    rest = rest.slice(best.idx + best.len);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
