import Link from "next/link";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const SAFE_HOSTS = ["www.medicare.gov", "www.medicaid.gov", "www.tricare.mil", "www.va.gov"];

/**
 * The honest stop. Overturn does not guess at Medicare/Medicaid/TRICARE rules; it says so
 * and links to the official process. Message and link come from the server response.
 */
export default async function UnsupportedPage({ searchParams }: { searchParams: Promise<{ msg?: string; url?: string }> }) {
  const { msg, url } = await searchParams;
  let safeUrl: string | null = null;
  try {
    if (url) {
      const u = new URL(url);
      if (u.protocol === "https:" && SAFE_HOSTS.includes(u.hostname)) safeUrl = u.toString();
    }
  } catch {
    safeUrl = null;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-primary sm:text-4xl">This one is outside what Overturn covers</h1>
      <div className="rounded-2xl border bg-card p-5">
        <p className="flex items-start gap-2">
          <Info className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>{msg ?? "This document belongs to a program with its own appeal process."}</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Rather than apply the wrong rules and show you a wrong deadline, Overturn stops here. The official process for your program is the
          right place, and it is free.
        </p>
        {safeUrl && (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
            Official appeal instructions <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Overturn covers job-based, Marketplace, and individual health plans. Medicare, Medicaid, CHIP, TRICARE, and VA use different appeal
        systems with different deadlines.
      </p>
      <Button variant="outline" className="h-11" nativeButton={false} render={<Link href="/start" />}>
        <ArrowLeft aria-hidden="true" /> Back to start
      </Button>
    </div>
  );
}
