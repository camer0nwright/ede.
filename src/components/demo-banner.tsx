import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shown while the screens are using the demo athlete. */
export function DemoBanner() {
  return (
    <Link
      href="/onboarding"
      className="flex items-center justify-between gap-3 rounded-2xl border border-primary-strong/50 bg-primary/10 p-4 transition-colors hover:bg-primary/20"
    >
      <span>
        <span className="block text-sm font-semibold">You&apos;re looking at a demo plan</span>
        <span className="block text-sm text-muted-foreground">Set up yours in about 3 minutes.</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-primary-strong" aria-hidden />
    </Link>
  );
}
