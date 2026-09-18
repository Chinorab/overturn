"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SAMPLES, type Sample } from "@/lib/samples";
import { useSession } from "@/lib/session";
import { Extraction, Explanation } from "@/lib/schemas/extraction";
import { cn } from "@/lib/utils";

type Phase = { kind: "idle" } | { kind: "working"; label: string; msg: string; sample: boolean } | { kind: "error"; title: string; message: string; resource_url?: string };

const PROGRESS = [
  [0, "Uploading your document…"],
  [3000, "Reading it page by page…"],
  [14000, "Pulling out the facts and where they come from…"],
  [24000, "Writing the plain-English summary…"],
  [40000, "Almost there…"],
] as const;

const ERROR_TITLE: Record<string, string> = {
  unsupported_program: "This document is outside what Overturn covers",
  not_a_claim_document: "This does not look like a denial or an EOB",
  unsupported_type: "That file type is not supported",
  too_large: "That file is too large",
  too_many_pages: "That PDF is too long",
  rate_limited: "Please wait a moment",
  uploads_paused: "Live uploads are paused",
  model_unavailable: "The reading service is unavailable",
  extraction_invalid: "Something did not check out",
};

/**
 * Step 1. Two ways in: a bundled sample (instant, cached, free) or a real upload
 * (one server call, nothing stored). Progress copy is a timer, not a fake percentage.
 */
export function IntakePanel() {
  const router = useRouter();
  const { setResult } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function submit(body: FormData, label: string) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    timers.current.forEach(clearTimeout);
    const isSample = body.has("sample_id");
    setPhase({ kind: "working", label, msg: isSample ? "Opening the sample…" : PROGRESS[0][1], sample: isSample });
    if (!isSample) {
      timers.current = PROGRESS.slice(1).map(([at, msg]) => window.setTimeout(() => setPhase((p) => (p.kind === "working" ? { ...p, msg } : p)), at));
    }
    try {
      const res = await fetch("/api/extract", { method: "POST", body, signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && json.code === "unsupported_program") {
          router.push(`/unsupported?code=${encodeURIComponent(json.code)}&msg=${encodeURIComponent(json.message)}&url=${encodeURIComponent(json.resource_url ?? "")}`);
          return;
        }
        setPhase({ kind: "error", title: ERROR_TITLE[json.code] ?? "Something went wrong", message: json.message ?? "Please try again.", resource_url: json.resource_url });
        return;
      }
      const extraction = Extraction.parse(json.extraction);
      const explanation = Explanation.parse(json.explanation);
      const sampleId = body.get("sample_id");
      const sample = typeof sampleId === "string" ? SAMPLES.find((s) => s.id === sampleId) : undefined;
      setResult(sample ? { kind: "sample", id: sample.id, title: sample.title } : { kind: "upload", name: label }, extraction, explanation);
      router.push("/understand");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPhase({ kind: "error", title: "Could not reach Overturn", message: "Check your connection and try again, or use a sample." });
    } finally {
      timers.current.forEach(clearTimeout);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    void submit(fd, file.name);
  }

  function onSample(s: Sample) {
    const fd = new FormData();
    fd.append("sample_id", s.id);
    void submit(fd, s.title);
  }

  function cancel() {
    abort.current?.abort();
    timers.current.forEach(clearTimeout);
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "working") {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">{phase.msg}</p>
            <p className="text-sm text-muted-foreground">
              {phase.label}
              {phase.sample ? "" : " · usually 20 to 40 seconds"}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3" aria-hidden="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <Button variant="ghost" className="mt-5 h-11" onClick={cancel}>
          <X aria-hidden="true" /> Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {phase.kind === "error" && (
        <div role="alert" className="rounded-2xl border border-warning/60 bg-warning/5 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            {phase.title}
          </p>
          <p className="mt-2 text-sm">{phase.message}</p>
          {phase.resource_url && (
            <a href={phase.resource_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
              Go to the right place for this document
            </a>
          )}
        </div>
      )}

      <section aria-labelledby="try-sample">
        <h2 id="try-sample" className="text-lg font-semibold">
          Try it with a sample
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Fictional documents, already read. Nothing is uploaded.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSample(s)}
                className="group flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:border-primary"
              >
                <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden="true" />
                  {s.document_type === "eob" ? "EOB" : "Denial letter"} · {s.state} · {s.pages} {s.pages === 1 ? "page" : "pages"}
                </span>
                <span className="mt-2 font-semibold group-hover:text-primary">{s.title}</span>
                <span className="mt-1 text-sm text-muted-foreground">{s.blurb}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="upload-own">
        <h2 id="upload-own" className="text-lg font-semibold">
          Or upload your own
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">PDF, JPG, or PNG, up to 10 MB and 20 pages. A phone photo of each page works. Processed once, then discarded.</p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card p-8 text-center transition-colors hover:border-primary/60 focus-within:border-primary",
            dragging && "border-primary bg-muted/40",
          )}
        >
          <UploadCloud className="size-8 text-primary" aria-hidden="true" />
          <span className="font-semibold">Choose a file or take a photo</span>
          <span className="text-sm text-muted-foreground">Drag and drop also works</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </section>
    </div>
  );
}
