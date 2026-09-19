"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock, FileText, Loader2, Lock, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SAMPLES, type Sample } from "@/lib/samples";
import { useSession } from "@/lib/session";
import { Extraction, Explanation } from "@/lib/schemas/extraction";
import { cn } from "@/lib/utils";

type Mode = "sample" | "upload";
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
export function IntakePanel({ initialMode = "sample" }: { initialMode?: Mode } = {}) {
  const router = useRouter();
  const { setResult } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [mode, setMode] = useState<Mode>(initialMode);
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
      <div role="status" aria-live="polite" className="surface rounded-2xl p-6">
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
    <div className="space-y-5">
      {phase.kind === "error" && (
        <div role="alert" className="rounded-2xl border border-warning/60 bg-warning/5 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            {phase.title}
          </p>
          <p className="mt-2 text-sm">{phase.message}</p>
          {phase.resource_url && (
            <a href={phase.resource_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
              Go to the right place for this document
            </a>
          )}
        </div>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-full p-1">
          <TabsTrigger value="sample" className="h-11 rounded-full text-base data-active:text-primary data-active:shadow-[var(--shadow-ambient)]">
            <FileText aria-hidden="true" /> Try a sample
          </TabsTrigger>
          <TabsTrigger value="upload" className="h-11 rounded-full text-base data-active:text-primary data-active:shadow-[var(--shadow-ambient)]">
            <UploadCloud aria-hidden="true" /> Upload mine
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sample" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <p className="text-sm text-muted-foreground">Seven fictional documents, already read. Pick one to see the whole flow; nothing is uploaded. (EOB = Explanation of Benefits, the statement your plan sends after a claim.)</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {SAMPLES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSample(s)}
                  className="group flex h-full w-full items-start gap-3 surface rounded-xl p-4 text-left transition-[transform,box-shadow,background-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:bg-muted/30"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug group-hover:text-primary">{s.title}</span>
                    <span className="mt-1 block text-xs uppercase tracking-wide text-muted-foreground">
                      {s.document_type === "eob" ? "EOB" : "Denial letter"} · {s.state}
                      {s.format === "jpg" ? " · phone photo" : ""}
                      {s.category === "unsupported" ? " · out of scope" : ""}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="upload" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
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
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-primary/60 focus-within:border-primary",
              dragging && "border-primary bg-muted/40",
            )}
          >
            <UploadCloud className="size-9 text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold">Choose a file or take a photo</span>
            <span className="text-sm text-muted-foreground">PDF, JPG, or PNG · up to 10 MB and 20 pages · drag and drop works too</span>
            <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="flex items-center gap-1.5"><Lock className="size-3.5" aria-hidden="true" /> Read once, then discarded</li>
            <li className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden="true" /> About 20 to 40 seconds</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" aria-hidden="true" /> Not Medicare or Medicaid</li>
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
