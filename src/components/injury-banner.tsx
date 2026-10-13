import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Injury } from "@/lib/domain";
import { bandSummary } from "@/lib/injury";

/** Shown on Today and Plan while the plan is adapted around an injury. */
export function InjuryBanner({ injury }: { injury: Injury }) {
  return (
    <Link href="/you" className="flex items-center justify-between gap-3 rounded-2xl border border-hard/40 bg-hard/10 p-4 transition-colors hover:bg-hard/20">
      <span>
        <span className="block text-sm font-semibold">
          Adapted for your {injury.area === "other" ? "injury" : injury.area} ({injury.painLevel}/10)
        </span>
        <span className="block text-sm text-muted-foreground">{bandSummary(injury)} Update it or mark it better in You.</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-hard" aria-hidden />
    </Link>
  );
}
