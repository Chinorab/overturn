import Link from "next/link";
import { FileText, ShieldCheck, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[680px] items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight text-primary">
            Overturn
          </Link>
          <span className="text-sm text-muted-foreground">Information, not legal advice</span>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-4 py-10">
        <h1 className="font-serif text-4xl font-semibold leading-tight text-primary sm:text-5xl">
          Your insurer said no.
          <br />
          Here is what that letter means, and what you can do.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Upload a denial letter or an Explanation of Benefits. Overturn reads it, explains it in
          plain English, shows the deadlines and protections that apply, and drafts an appeal
          letter you edit and send yourself.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-12 text-base" disabled>
            <FileText aria-hidden="true" />
            Try with a sample letter
          </Button>
          <Button size="lg" variant="outline" className="h-12 text-base" disabled>
            Upload my document
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Under construction — the flow ships over the coming days.
        </p>

        <section aria-labelledby="is-isnot" className="mt-12 grid gap-4 sm:grid-cols-2">
          <h2 id="is-isnot" className="sr-only">
            What Overturn is and is not
          </h2>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Scale className="size-5 text-primary" aria-hidden="true" />
              What this is
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>A plain-English reading of your denial or EOB.</li>
              <li>The appeal rights and deadlines that generally apply, with the source for each.</li>
              <li>A draft letter that you review, edit, and send.</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              What this is not
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Not a lawyer and not legal advice. It does not tell you what to do.</li>
              <li>Not a prediction of whether your appeal will succeed.</li>
              <li>Not a place your documents are kept. They are processed, then discarded.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-[680px] px-4 py-6 text-sm text-muted-foreground">
          Overturn provides general legal information for people in the United States. It is not
          a substitute for advice from a licensed attorney or your state Consumer Assistance
          Program. Documents are processed in memory and never stored.
        </div>
      </footer>
    </>
  );
}
