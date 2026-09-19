"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ClipboardCopy, Download, ExternalLink, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiLabel } from "@/components/ai-label";
import { citedRules, LetterRichText, letterToPlainText } from "@/components/letter-text";
import { FillInForm } from "@/components/fill-in-form";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { LetterDraft } from "@/lib/schemas/letter";
import { useSession, type LetterState } from "@/lib/session";
import { buildSituation } from "@/lib/situation";
import type { Situation } from "@/lib/schemas/situation";

type Phase = { kind: "loading"; msg: string } | { kind: "error"; message: string } | { kind: "ready" };

/**
 * Step 4. The draft is the user's: every section is editable, unknowns are visible
 * placeholders, every legal reference is one the rules engine produced. Download or copy,
 * then the "before you send" checklist and the human-help pointer.
 */
export default function LetterPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const ready = !!session.extraction && session.confirmed && !!session.answers;
  useEffect(() => {
    if (hydrated && !ready) router.replace(session.extraction ? (session.confirmed ? "/rights" : "/understand") : "/start");
  }, [hydrated, ready, router, session.extraction, session.confirmed]);
  if (!hydrated || !ready) return null;
  const situation = buildSituation(session.extraction!, session.answers!);
  if (!situation) return null;
  return <LetterView situation={situation} sampleId={session.source?.kind === "sample" ? session.source.id : undefined} />;
}

function LetterView({ situation, sampleId }: { situation: Situation; sampleId?: string }) {
  const { session, setLetter } = useSession();
  const letter = session.letter;
  const [phase, setPhase] = useState<Phase>(letter ? { kind: "ready" } : { kind: "loading", msg: "Drafting your letter…" });
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const requested = useRef(false);

  const rights = useMemo(() => computeRights(situation, ALL_RULES, HELP_RESOURCES), [situation]);

  const fetchDraft = useCallback(async () => {
    setPhase({ kind: "loading", msg: sampleId ? "Opening the letter…" : "Drafting your letter… usually 20 to 40 seconds" });
    try {
      const res = await fetch("/api/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ situation, sample_id: sampleId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase({ kind: "error", message: json.message ?? "Something went wrong." });
        return;
      }
      const draft = LetterDraft.parse(json.draft);
      setLetter(draft);
      setPhase({ kind: "ready" });
    } catch {
      setPhase({ kind: "error", message: "Could not reach Overturn. Check your connection and try again." });
    }
  }, [situation, sampleId, setLetter]);

  useEffect(() => {
    if (!letter && !requested.current) {
      requested.current = true;
      void fetchDraft();
    }
  }, [letter, fetchDraft]);

  const rules = useMemo(() => (letter ? citedRules(letter.sections) : []), [letter]);
  const plain = useMemo(() => (letter ? letterToPlainText(letter.sections) : ""), [letter]);
  const placeholders = useMemo(() => (letter ? Array.from(new Set(Array.from(plain.matchAll(/\[ADD:\s*([^\]]+)\]/g), (m) => m[1].trim()))) : []), [letter, plain]);

  function updateSection(id: string, text: string) {
    if (!letter) return;
    const next: LetterState = { ...letter, sections: letter.sections.map((s) => (s.id === id ? { ...s, text } : s)) };
    setLetter(next);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: user can still select the text */
    }
  }

  async function downloadPdf() {
    if (!letter) return;
    setDownloading(true);
    try {
      const [{ pdf }, { LetterPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/letter-pdf")]);
      const blob = await pdf(<LetterPdf sections={letter.sections} rules={rules} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "appeal-letter.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setDownloading(false);
    }
  }

  if (phase.kind === "loading" || !letter) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-[2.2rem] font-medium leading-[1.08] text-primary sm:text-[2.75rem]">Your appeal letter</h1>
        {phase.kind === "error" ? (
          <div role="alert" className="rounded-2xl border border-warning/60 bg-warning/5 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-5 text-warning" aria-hidden="true" /> Could not draft the letter
            </p>
            <p className="mt-2 text-sm">{phase.message}</p>
            <div className="mt-4 flex gap-3">
              <Button className="h-11" onClick={() => void fetchDraft()}>
                <RefreshCw aria-hidden="true" /> Try again
              </Button>
              <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/rights" />}>
                <ArrowLeft aria-hidden="true" /> Back
              </Button>
            </div>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="surface rounded-2xl p-6">
            <p className="flex items-center gap-3 font-semibold">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              {phase.kind === "loading" ? phase.msg : "Drafting your letter…"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Built only from the facts you confirmed and the {rights.rules.length} rules that apply. Anything Overturn does not know becomes a blank for you to fill.</p>
            <div className="mt-5 space-y-3" aria-hidden="true">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const guard = letter.guard_report;

  return (
    <div className="space-y-8 pb-24 sm:pb-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif text-[2.2rem] font-medium leading-[1.08] text-primary sm:text-[2.75rem]">Your appeal letter</h1>
          <AiLabel what="Drafted by AI from your facts and rights" />
        </div>
        <p className="mt-2 text-muted-foreground">
          A draft written in the first person, for you to finish. Fill in the blanks below, then tap any part of the letter to edit it. The small
          numbers point to the laws cited; the full citations are written into the letter you download or copy.
        </p>
      </header>

      {(guard.prescriptive_hits.length > 0 || guard.unknown_citations.length > 0) && (
        <div className="rounded-xl border border-warning/60 bg-warning/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Overturn&apos;s checks flagged something
          </p>
          {guard.prescriptive_hits.length > 0 && <p className="mt-1">Advice-like wording slipped in ({guard.prescriptive_hits.join(", ")}). Consider rephrasing as a statement of fact.</p>}
          {guard.unknown_citations.length > 0 && <p className="mt-1">A reference the rules did not support was removed.</p>}
        </div>
      )}

      <FillInForm letter={letter} onApply={(next) => setLetter(next)} />

      {placeholders.length > 0 && (
        <section aria-labelledby="blanks" className="surface rounded-2xl p-5">
          <h2 id="blanks" className="font-semibold">
            {placeholders.length} {placeholders.length === 1 ? "blank" : "blanks"} still to fill in the letter
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Overturn never guesses a fact it does not have. Tap the section that contains one to write it in:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {placeholders.map((p) => (
              <li key={p}>
                <mark className="placeholder-chip">[ADD: {p}]</mark>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="letter" className="surface rounded-2xl bg-paper p-5 sm:p-8">
        <h2 id="letter" className="sr-only">
          Letter text
        </h2>
        {letter.sections.map((sec) => (
          <div key={sec.id} className="group relative -mx-2 rounded-lg px-2 py-2 hover:bg-muted/40">
            {editing === sec.id ? (
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`edit-${sec.id}`}>
                  Editing: {sec.heading || sec.id}
                </label>
                <textarea
                  id={`edit-${sec.id}`}
                  value={sec.text}
                  onChange={(e) => updateSection(sec.id, e.target.value)}
                  rows={Math.max(4, sec.text.split("\n").length + 2)}
                  className="mt-1 w-full rounded-lg border border-input bg-card p-3 font-serif text-base leading-relaxed focus-visible:outline-3 focus-visible:outline-ring"
                />
                <Button size="sm" className="mt-2 h-10" onClick={() => setEditing(null)}>
                  <Check aria-hidden="true" /> Done
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(sec.id)} className="w-full text-left" aria-label={`Edit section: ${sec.heading || sec.id}`}>
                {sec.heading && <p className="font-serif font-semibold">{sec.heading}</p>}
                <div className="whitespace-pre-line font-serif text-[1.05rem] leading-relaxed">
                  <LetterRichText text={sec.text} numbering={rules.map((r) => r.id)} />
                </div>
                <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 group-focus-within:opacity-100">
                  <Pencil className="size-3" aria-hidden="true" /> Edit
                </span>
              </button>
            )}
          </div>
        ))}
      </section>

      <div className="hidden gap-3 sm:flex">
        <Button className="h-12 text-base" onClick={downloadPdf} disabled={downloading}>
          {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} Download as PDF
        </Button>
        <Button variant="outline" className="h-12 text-base" onClick={copyText}>
          {copied ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />} {copied ? "Copied" : "Copy the text"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="attach" className="surface rounded-2xl p-5">
          <h2 id="attach" className="font-semibold">
            What to attach
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {letter.checklist.map((c) => (
              <li key={c.item} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="font-medium">{c.item}</span>
                  <span className="block text-muted-foreground">{c.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sendto" className="surface rounded-2xl p-5">
          <h2 id="sendto" className="font-semibold">
            Where to send it
          </h2>
          {letter.send_to.address ? <p className="mt-3 whitespace-pre-line text-sm">{letter.send_to.address}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">{letter.send_to.verify_note}</p>
        </section>
      </div>

      <section aria-labelledby="before" className="surface-strong rounded-2xl p-5">
        <h2 id="before" className="text-lg font-semibold">
          Before you send
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Read the whole letter and fill every blank. Remove anything that is not true for you.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Ask the treating provider for a short letter of support; it is the single most persuasive attachment.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Send by a method that gives proof of the date (certified mail, fax confirmation, or the plan&apos;s portal), and keep a copy of everything.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Write down the date you sent it; the plan&apos;s response clock starts then.</li>
        </ul>
        <div className="mt-4 rounded-lg bg-muted/70 p-3 text-sm">
          <p className="font-medium">Free help from a person, if you want a second pair of eyes</p>
          {rights.help.slice(0, 2).map((h) => (
            <p key={h.id} className="mt-1">
              {h.name}
              {h.phone ? ` · ${h.phone}` : ""} ·{" "}
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
                website <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </p>
          ))}
        </div>
      </section>

      {rules.length > 0 && (
        <section aria-labelledby="refs" className="text-sm text-muted-foreground">
          <h2 id="refs" className="font-semibold text-foreground">
            References used in this letter
          </h2>
          <ol className="mt-2 list-none space-y-1.5">
            {rules.map((r, i) => (
              <li key={r.id} id={`ref-${r.id}`} className="flex gap-2 scroll-mt-24">
                <span className="w-6 shrink-0 font-medium text-primary tnum">[{i + 1}]</span>
                <span>
                {r.legal_ref} — {r.title}.{" "}
                <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
                  source
                </a>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex justify-start">
        <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/rights" />}>
          <ArrowLeft aria-hidden="true" /> Back to my rights
        </Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card/95 p-3 backdrop-blur sm:hidden">
        <Button className="h-12 flex-1 text-base" onClick={downloadPdf} disabled={downloading}>
          {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} Download PDF
        </Button>
        <Button variant="outline" className="h-12 flex-1 text-base" onClick={copyText}>
          {copied ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />} {copied ? "Copied" : "Copy text"}
        </Button>
      </div>
    </div>
  );
}
