import Link from "next/link";
import { Flag } from "lucide-react";
import type { Phase } from "@/lib/domain";
import type { OutlineWeek } from "@/lib/plan-outline";
import { PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

type Segment = { phase: Exclude<Phase, "recovery">; from: number; weeks: number };

/**
 * The plan's phases as segments: base, build, peak and taper. Recovery weeks
 * belong to the phase around them (they're its lighter weeks), so the
 * timeline reads as a few clear blocks.
 */
export function phaseSegments(weeks: { phase: Phase }[]): Segment[] {
  const main = weeks.map((w) => w.phase);
  // A recovery week takes the phase before it (or after, at the very start).
  for (let i = 0; i < main.length; i++) {
    if (main[i] === "recovery") main[i] = (i > 0 ? main[i - 1] : main.find((p) => p !== "recovery")) ?? "base";
  }
  const segments: Segment[] = [];
  main.forEach((phase, i) => {
    const last = segments.at(-1);
    if (last && last.phase === phase) last.weeks++;
    else segments.push({ phase: phase as Segment["phase"], from: i, weeks: 1 });
  });
  return segments;
}

/** Labels under the timeline: short neighbouring phases share one ("Peak · Taper") so names aren't cut off. */
export function phaseLabels(segments: Segment[], minWeeks = 3): { text: string; from: number; weeks: number }[] {
  const labels: { text: string; from: number; weeks: number; short: boolean }[] = [];
  for (const s of segments) {
    const short = s.weeks < minWeeks;
    const last = labels.at(-1);
    if (short && last?.short) {
      last.text += ` · ${PHASE_LABEL[s.phase]}`;
      last.weeks += s.weeks;
    } else labels.push({ text: PHASE_LABEL[s.phase], from: s.from, weeks: s.weeks, short });
  }
  return labels.map(({ text, from, weeks }) => ({ text, from, weeks }));
}

/** The whole plan at a glance: a bar per week (height = training time), with the phases labelled underneath. */
export function PhaseStrip({ weeks, currentWeek, race }: { weeks: OutlineWeek[]; currentWeek?: number; race?: boolean }) {
  const load = (w: OutlineWeek) => w.runMinutes + w.strengthMinutes;
  const max = Math.max(...weeks.map(load));
  const segments = phaseSegments(weeks);
  const labels = phaseLabels(segments);
  const columns = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` };

  return (
    <figure className="m-0">
      <div className="flex items-end gap-1.5">
        <div className="grid h-20 flex-1 items-end gap-[3px]" style={columns} role="list" aria-label="Training load by week">
          {weeks.map((w) => {
            const state = currentWeek === undefined || w.weekNumber > currentWeek ? "future" : w.weekNumber === currentWeek ? "current" : "past";
            return (
              <Link
                key={w.weekNumber}
                prefetch
                href={`/plan/week/${w.weekNumber}`}
                role="listitem"
                aria-label={`Week ${w.weekNumber}, ${PHASE_LABEL[w.phase]}, ${load(w)} minutes${state === "current" ? ", this week" : ""}`}
                className="group flex h-full items-end"
              >
                <span
                  className={cn(
                    "w-full rounded-[3px] transition-opacity group-hover:opacity-70",
                    state === "current" ? "bg-foreground" : state === "past" ? "bg-foreground/35" : "bg-foreground/12",
                  )}
                  style={{ height: `${Math.max(10, (load(w) / max) * 100)}%` }}
                />
              </Link>
            );
          })}
        </div>
        {race && <Flag className="mb-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Race day" />}
      </div>

      <div className={cn("mt-2 grid gap-[3px]", race && "mr-[22px]")} style={columns} aria-hidden>
        {segments.map((s) => (
          <span key={s.from} className={cn("h-1 rounded-full", PHASE_COLOR[s.phase])} style={{ gridColumn: `${s.from + 1} / span ${s.weeks}` }} />
        ))}
        {labels.map((l, i) => (
          <span
            key={l.from}
            className={cn("mt-1 text-[11px] whitespace-nowrap text-muted-foreground", i === labels.length - 1 && i > 0 && "text-right")}
            style={{ gridColumn: `${l.from + 1} / span ${l.weeks}`, gridRow: 2, direction: i === labels.length - 1 && i > 0 ? "rtl" : undefined }}
          >
            <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{l.text}</span>
          </span>
        ))}
      </div>

      <figcaption className="mt-2 text-xs text-muted-foreground">
        Taller bars are bigger weeks. The short ones in between are lighter weeks to recover.
      </figcaption>
    </figure>
  );
}
