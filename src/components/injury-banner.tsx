import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Injury } from "@/lib/domain";
import { bandSummary } from "@/lib/injury";

/** Shown on Today and Plan while the plan is adapted around an injury. */
export function InjuryBanner({ injury }: { injury: Injury }) {
  return (
    <Link href="/you" className="flex items-center gap-3 rounded-2xl bg-hard/10 px-4 py-3 transition-colors hover:bg-hard/15">
      <span className="size-2 shrink-0 rounded-full bg-hard" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">
          Adapted for your {injury.area === "other" ? "injury" : injury.area} ({injury.painLevel}/10)
        </span>
        <span className="block text-muted-foreground">{bandSummary(injury)}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
