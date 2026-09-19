"use client";

import { useMemo, useState } from "react";
import { Check, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/native-select";
import type { LetterState } from "@/lib/session";
import { fmtLong } from "@/lib/format";
import { toISO } from "@/lib/rules/deadlines";

/**
 * The blanks every letter has (name, address, phone, email, date) filled once, from one
 * short form, instead of edited by hand in seven places on a phone keyboard. Nothing is
 * sent anywhere: the values go straight into the letter text in the browser tab.
 */
type Field = { key: string; label: string; match: RegExp; type?: string; autoComplete?: string };

const FIELDS: Field[] = [
  // "[ADD: your signature]" is deliberately left alone: it is signed by hand.
  { key: "name", label: "Your full name", match: /\[ADD:\s*(your full name|full name|your name|member name)\s*\]/gi, autoComplete: "name" },
  { key: "street", label: "Street address", match: /\[ADD:\s*(your street address|street address|your address|your mailing address)\s*\]/gi, autoComplete: "street-address" },
  { key: "city", label: "City, state, ZIP", match: /\[ADD:\s*(city, state,? zip|city, state, and zip|your city, state,? zip)\s*\]/gi },
  { key: "phone", label: "Phone number", match: /\[ADD:\s*(your phone number|phone number|your telephone number)\s*\]/gi, type: "tel", autoComplete: "tel" },
  { key: "email", label: "Email address", match: /\[ADD:\s*(your email address|email address|your email)\s*\]/gi, type: "email", autoComplete: "email" },
];

export function FillInForm({ letter, onApply }: { letter: LetterState; onApply: (next: LetterState) => void }) {
  const text = useMemo(() => letter.sections.map((s) => s.text).join("\n"), [letter]);
  const present = useMemo(() => FIELDS.filter((f) => new RegExp(f.match.source, "i").test(text)), [text]);
  const hasDate = /\[ADD:\s*today'?s date\s*\]/i.test(text);
  const [values, setValues] = useState<Record<string, string>>({});
  const [useToday, setUseToday] = useState(true);
  const [applied, setApplied] = useState(false);

  if (present.length === 0 && !hasDate) return null;

  function apply() {
    const today = fmtLong(toISO(new Date()));
    const next: LetterState = {
      ...letter,
      sections: letter.sections.map((s) => {
        let t = s.text;
        for (const f of present) {
          const v = values[f.key]?.trim();
          if (v) t = t.replace(new RegExp(f.match.source, "gi"), v);
        }
        if (hasDate && useToday) t = t.replace(/\[ADD:\s*today'?s date\s*\]/gi, today);
        return { ...s, text: t };
      }),
    };
    onApply(next);
    setApplied(true);
  }

  return (
    <section aria-labelledby="fill-in" className="surface-strong rounded-2xl p-5">
      <h2 id="fill-in" className="flex items-center gap-2 text-lg font-semibold">
        <PenLine className="size-5 text-primary" aria-hidden="true" />
        Fill in your details once
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These go into every place the letter needs them. They stay in this browser tab; nothing is sent or saved.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {present.map((f) => (
          <label key={f.key} className="block text-sm font-medium">
            {f.label}
            <TextInput
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1"
            />
          </label>
        ))}
        {hasDate && (
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2">
            <input type="checkbox" checked={useToday} onChange={(e) => setUseToday(e.target.checked)} className="size-4 accent-primary" />
            Date the letter today ({fmtLong(toISO(new Date()))})
          </label>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="h-11" onClick={apply}>
          <Check aria-hidden="true" /> Put these in the letter
        </Button>
        {applied && <span className="text-sm text-success">Done. Anything you left empty stays as a blank to fill by hand.</span>}
      </div>
    </section>
  );
}
