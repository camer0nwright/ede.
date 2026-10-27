import Link from "next/link";
import type { OutlineWeek } from "@/lib/plan-outline";
import { PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The whole plan at a glance: one bar per week, height = training time, colour
 * = phase, with week labels underneath. `ringOffset` matches the surface the
 * strip sits on, so the current week's outline has a clean gap.
 */
export function PhaseStrip({ weeks, currentWeek, ringOffset = "ring-offset-background" }: { weeks: OutlineWeek[]; currentWeek?: number; ringOffset?: string }) {
  const every = weeks.length <= 12 ? 1 : weeks.length <= 24 ? 2 : 4;
  const max = Math.max(...weeks.map((w) => w.runMinutes + w.strengthMinutes));
  const phases = [...new Set(weeks.map((w) => w.phase))];
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="list" aria-label="Training load by week">
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
                  "w-full transition-opacity group-hover:opacity-80",
                  PHASE_COLOR[w.phase],
                  w.weekNumber === currentWeek && cn("ring-2 ring-foreground ring-offset-2", ringOffset),
                )}
                style={{ height: `${Math.max(12, (load / max) * 100)}%` }}
              />
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        {weeks.map((w, i) => (
          <span key={w.weekNumber} className={cn("flex-1 text-center", w.weekNumber === currentWeek && "font-semibold text-foreground")}>
            {i % every === 0 || w.weekNumber === currentWeek ? `W${w.weekNumber}` : ""}
          </span>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
