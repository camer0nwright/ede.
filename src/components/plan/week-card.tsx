import Link from "next/link";
import { ChevronRight, Dumbbell, Footprints } from "lucide-react";
import type { OutlineWeek } from "@/lib/plan-outline";
import { formatMinutes, formatWeekRange, PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { RUN_LIBRARY } from "@/lib/session-library";
import { cn } from "@/lib/utils";

export function WeekCard({ week, current }: { week: OutlineWeek; current?: boolean }) {
  const quality = week.runs.filter((r) => r.role === "quality").map((r) => RUN_LIBRARY[r.kind].label);
  const long = week.runs.filter((r) => r.role === "long");
  const headline = [...quality, ...long.map((r) => `${r.backToBack ? "Back-to-back" : "Long run"} ${formatMinutes(r.minutes)}`)];

  return (
    <Link
      prefetch
      href={`/plan/week/${week.weekNumber}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent",
        current && "border-primary-strong",
      )}
    >
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Wk</span>
        <span className="font-display text-3xl leading-none">{week.weekNumber}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", PHASE_COLOR[week.phase])} aria-hidden />
          <span className="font-medium text-foreground">{PHASE_LABEL[week.phase]}</span>
          <span>{formatWeekRange(week.weekStart)}</span>
          {current && <span className="font-semibold text-primary-strong">This week</span>}
        </div>
        <p className="mt-1 truncate text-sm font-medium">{headline.join(" · ") || "Easy running"}</p>
        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Footprints className="size-3.5 text-run" aria-hidden />
            {week.runs.length} runs · {formatMinutes(week.runMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="size-3.5 text-strength" aria-hidden />
            {week.strength.length} {week.strength.length === 1 ? "lift" : "lifts"}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
