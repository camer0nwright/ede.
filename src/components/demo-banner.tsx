import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Shown while the screens are using the demo athlete. */
export function DemoBanner() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary/15 px-4 py-3">
      <span className="size-2 shrink-0 rounded-full bg-primary-strong" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">
        <Link href="/onboarding" className="flex items-center justify-between font-medium">
          This is a demo plan. Set up yours <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <span className="block text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </span>
      </span>
    </div>
  );
}
