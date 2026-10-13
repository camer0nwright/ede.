import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WeekPlan } from "@/lib/domain";
import { formatMinutes, formatWeekRange, PHASE_COLOR, PHASE_LABEL, plural } from "@/lib/format";
import { RUN_LIBRARY } from "@/lib/session-library";
import { cn } from "@/lib/utils";

/** One week in the plan list: its key sessions and totals, as built (injury changes included). */
export function WeekCard({ week, current, injured }: { week: WeekPlan; current?: boolean; injured?: boolean }) {
  const runs = week.sessions.filter((s) => s.type === "run");
  const lifts = week.sessions.length - runs.length;
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
      className={cn("-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent/60", current && "bg-card ring-1 ring-border")}
    >
      <span className="w-7 shrink-0 text-center font-display text-2xl tabular-nums">{week.weekNumber}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", PHASE_COLOR[week.phase])} aria-hidden />
          {PHASE_LABEL[week.phase]} · {formatWeekRange(week.weekStart)}
          {current && <span className="font-medium text-primary-strong">· This week</span>}
        </span>
        <span className="mt-0.5 block truncate font-medium">
          {injured && <span className="text-hard">Injury · </span>}
          {headline.join(" · ") || (runs.length > 0 ? "Easy running" : "No running")}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatMinutes(runMinutes)} running · {plural(runs.length, "run")} · {plural(lifts, "lift")}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
