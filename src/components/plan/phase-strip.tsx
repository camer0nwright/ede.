import Link from "next/link";
import type { OutlineWeek } from "@/lib/plan-outline";
import { PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The whole plan at a glance: one bar per week, height = training time, colour = phase. */
export function PhaseStrip({ weeks, currentWeek }: { weeks: OutlineWeek[]; currentWeek?: number }) {
  const max = Math.max(...weeks.map((w) => w.runMinutes + w.strengthMinutes));
  const phases = [...new Set(weeks.map((w) => w.phase))];
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]" role="list" aria-label="Training load by week">
        {weeks.map((w) => {
          const load = w.runMinutes + w.strengthMinutes;
          return (
            <Link
              key={w.weekNumber}
              prefetch
              href={`/plan/week/${w.weekNumber}`}
              role="listitem"
              aria-label={`Week ${w.weekNumber}, ${PHASE_LABEL[w.phase]}, ${load} minutes`}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={cn(
                  "w-full rounded-t-[3px] transition-opacity group-hover:opacity-80",
                  PHASE_COLOR[w.phase],
                  w.weekNumber === currentWeek && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ height: `${Math.max(12, (load / max) * 100)}%` }}
              />
            </Link>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {phases.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", PHASE_COLOR[p])} aria-hidden />
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ul>
    </div>
  );
}
