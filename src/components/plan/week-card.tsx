import Link from "next/link";
import { ChevronRight, Dumbbell, Footprints } from "lucide-react";
import type { WeekPlan } from "@/lib/domain";
import { formatMinutes, formatWeekRange, PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { RUN_LIBRARY } from "@/lib/session-library";
import { cn } from "@/lib/utils";

/** One week in the plan list: its key sessions and totals, as built (injury changes included). */
export function WeekCard({ week, current, injured }: { week: WeekPlan; current?: boolean; injured?: boolean }) {
  const runs = week.sessions.filter((s) => s.type === "run");
  const lifts = week.sessions.filter((s) => s.type === "strength");
  const role = (s: (typeof runs)[number]) => (s.kind ? RUN_LIBRARY[s.kind].role : "easy");
  const headline = [
    ...runs.filter((r) => role(r) === "quality").map((r) => r.title),
    ...runs.filter((r) => role(r) === "long").map((r) => `${r.title} ${formatMinutes(r.plannedMinutes)}`),
  ];
  const runMinutes = runs.reduce((sum, r) => sum + r.plannedMinutes, 0);

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
        <p className="mt-1 truncate text-sm font-medium">
          {injured && <span className="text-hard">Injury · </span>}
          {headline.join(" · ") || (runs.length > 0 ? "Easy running" : "No running")}
        </p>
        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Footprints className="size-3.5 text-run" aria-hidden />
            {runs.length} {runs.length === 1 ? "run" : "runs"} · {formatMinutes(runMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="size-3.5 text-strength" aria-hidden />
            {lifts.length} {lifts.length === 1 ? "lift" : "lifts"}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
