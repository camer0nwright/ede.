// Rebuilding a plan after the athlete changes their settings, or returns from
// an injury (SPEC decision 41): the weeks up to and including this one stay as
// they are, and a new outline starts next Monday, carrying on from this week's
// running so the progression continues smoothly.
import { addDays, dayOfWeek } from "./dates";
import type { WeekPlan } from "./domain";
import { buildPlanOutline, type OutlineInput, type PlanOutline } from "./plan-outline";

/** The Monday of the week containing `date`. */
export const mondayOf = (date: string) => addDays(date, -dayOfWeek(date));

/** Where a rebuilt plan starts: next Monday, or the plan's own start if it hasn't begun yet. */
export function rebuildStart(today: string, planStart: string): string {
  const next = addDays(mondayOf(today), 7);
  return planStart > today ? planStart : next;
}

/** What the new outline carries on from: this week's run minutes and its long run. */
export function continuityFrom(week: WeekPlan | undefined): { lastWeekRunMinutes?: number; longestRecentRunMinutes?: number } {
  if (!week) return {};
  const runs = week.sessions.filter((s) => s.type === "run");
  if (runs.length === 0) return { lastWeekRunMinutes: 0, longestRecentRunMinutes: 0 };
  return {
    lastWeekRunMinutes: runs.reduce((sum, r) => sum + r.plannedMinutes, 0),
    longestRecentRunMinutes: Math.max(...runs.map((r) => r.plannedMinutes)),
  };
}

/** Continuity from the weeks kept: the last full week, since recovery and taper weeks are deliberately lighter. */
export function continuityFromWeeks(kept: WeekPlan[]) {
  const full = kept.findLast((w) => w.phase !== "recovery" && w.phase !== "taper");
  return continuityFrom(full ?? kept.at(-1));
}

/**
 * The old plan's weeks before `start`, then a new outline from `start`,
 * numbered on from the kept weeks. Blocks continue too, so main lifts change
 * at the new plan's first block rather than mid-block.
 */
export function rebuildOutline(old: PlanOutline, input: OutlineInput, start: string): PlanOutline {
  const kept = old.weeks.filter((w) => w.weekStart < start);
  const fresh = buildPlanOutline({ ...input, startDate: start, priorWeeks: kept });
  const blockOffset = kept.length > 0 ? kept.at(-1)!.block : 0;
  return {
    weeks: [
      ...kept,
      ...fresh.weeks.map((w, i) => ({ ...w, weekNumber: kept.length + i + 1, block: w.block + blockOffset })),
    ],
    taperWeeks: fresh.taperWeeks,
    notes: fresh.notes,
  };
}

/**
 * The share of the pre-injury load to come back at. Mild injuries kept some
 * easy running: 80%. Otherwise about 10% less per week out, from 70%, never
 * below 30% (the starting load then applies).
 */
export function returnShare(weeksOut: number, ranDuringInjury: boolean): number {
  return ranDuringInjury ? 0.8 : Math.max(0.3, 0.7 - 0.1 * Math.max(0, weeksOut - 1));
}

/** A gentle return after an injury (SPEC decision 42): less load the longer and worse it was. */
export function returnFromInjury(
  before: { lastWeekRunMinutes: number; longestRecentRunMinutes: number },
  weeksOut: number,
  ranDuringInjury: boolean,
): { lastWeekRunMinutes: number; longestRecentRunMinutes: number } {
  const share = returnShare(weeksOut, ranDuringInjury);
  return {
    lastWeekRunMinutes: Math.round(before.lastWeekRunMinutes * share),
    longestRecentRunMinutes: Math.round(before.longestRecentRunMinutes * share),
  };
}
