import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Plain-English legal pages (privacy, terms): a heading, then boxed sections. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex flex-col gap-4 pt-6">
      <Link href="/you" className="-ml-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> You
      </Link>
      <header>
        <h1 className="text-4xl font-medium tracking-tighter">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
        <div className="mt-3 text-sm text-muted-foreground">{intro}</div>
      </header>
      {children}
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 text-sm leading-relaxed">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** Small links to the legal pages, for the foot of sign-up, log-in and You. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-center text-xs text-muted-foreground"}>
      <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
        Privacy
      </Link>
      {" · "}
      <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
        Terms
      </Link>
    </p>
  );
}
