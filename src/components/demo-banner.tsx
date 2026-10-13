import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Shown while the screens are using the demo athlete. */
export function DemoBanner() {
  return (
    <Link href="/onboarding" className="flex items-center gap-3 rounded-2xl bg-primary/15 px-4 py-3 transition-colors hover:bg-primary/25">
      <span className="size-2 shrink-0 rounded-full bg-primary-strong" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">This is a demo plan</span>
        <span className="block text-muted-foreground">Set up your own in about 3 minutes.</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
