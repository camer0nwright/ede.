// How the plan reacts to missed and skipped sessions (SPEC: Skip workout
// behaviour, decision 50). Missed sessions are never crammed in later. After
// a skip for illness or tiredness, the next two sessions are eased. A week
// that was mostly missed leads to an offer to ease back in.
import { sessionKey, type CheckIn, type SkipReason } from "./checkin";
import { addDays, daysBetween } from "./dates";
import type { PlannedSession, WeekPlan } from "./domain";
import { easyVersion } from "./injury";

/** Skips that ease the next sessions, and the note those sessions get. */
const EASE_NOTE: Partial<Record<SkipReason, string>> = {
  illness: "Easier after being ill: keep it gentle, and stop if you feel unwell.",
  fatigue: "Easier after a tired day: keep it comfortable.",
};
const LIFT_NOTE: Partial<Record<SkipReason, string>> = {
  illness: "After being ill, go lighter if you're not back to 100%.",
  fatigue: "Go lighter today if you still feel tired.",
};
export const EASE_SESSIONS = 2;
const EASE_WINDOW_DAYS = 7;

/**
 * The weeks with the next two sessions after the latest recent skip for
 * illness or tiredness made easier: hard runs become easy runs of the same
 * length, and lifts get a note to go lighter. Sessions already checked in stay.
 */
export function easeAfterSkips(weeks: WeekPlan[], checkIns: Record<string, CheckIn>, today: string): WeekPlan[] {
  const triggers = Object.entries(checkIns)
    .flatMap(([key, c]) => (c.status === "skipped" && EASE_NOTE[c.skipReason] ? [{ date: key.slice(0, 10), reason: c.skipReason }] : []))
    .filter((t) => daysBetween(t.date, today) <= EASE_WINDOW_DAYS)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const trigger = triggers[0];
  if (!trigger) return weeks;

  const next = weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.date > trigger.date && !checkIns[sessionKey(s.date, s.slot)])
    .sort((a, b) => (a.date === b.date ? a.slot - b.slot : a.date < b.date ? -1 : 1))
    .slice(0, EASE_SESSIONS);
  if (next.length === 0) return weeks;
  const eased = new Set(next.map((s) => sessionKey(s.date, s.slot)));

  return weeks.map((w) => {
    if (!w.sessions.some((s) => eased.has(sessionKey(s.date, s.slot)))) return w;
    const dayNotes = { ...w.dayNotes };
    const sessions = w.sessions.map((s): PlannedSession => {
      if (!eased.has(sessionKey(s.date, s.slot))) return s;
      if (s.type === "run") {
        dayNotes[s.date] = EASE_NOTE[trigger.reason]!;
        return s.intensity === "easy" ? s : easyVersion(s, s.plannedMinutes);
      }
      dayNotes[s.date] = dayNotes[s.date] ?? LIFT_NOTE[trigger.reason]!;
      return s;
    });
    return { ...w, sessions, dayNotes };
  });
}

export type WeekReview = {
  weekStart: string;
  plannedRunMinutes: number;
  doneRunMinutes: number;
  longestDoneRun: number;
  /** Sessions skipped, and their reasons. */
  skipped: SkipReason[];
  /** Sessions neither done nor skipped. */
  missed: number;
};

/** What happened in a week that's over: running done against planned, and what was skipped or missed. */
export function reviewWeek(week: WeekPlan, checkIns: Record<string, CheckIn>): WeekReview {
  const runs = week.sessions.filter((s) => s.type === "run");
  const done = runs.flatMap((r) => {
    const c = checkIns[sessionKey(r.date, r.slot)];
    return c?.status === "completed" ? [c.actualMinutes] : [];
  });
  return {
    weekStart: week.weekStart,
    plannedRunMinutes: runs.reduce((sum, r) => sum + r.plannedMinutes, 0),
    doneRunMinutes: done.reduce((a, b) => a + b, 0),
    longestDoneRun: Math.max(0, ...done),
    skipped: week.sessions.flatMap((s) => {
      const c = checkIns[sessionKey(s.date, s.slot)];
      return c?.status === "skipped" ? [c.skipReason] : [];
    }),
    missed: week.sessions.filter((s) => !checkIns[sessionKey(s.date, s.slot)]).length,
  };
}

/** Less than this share of a week's planned running done means easing back in is offered. */
export const EASE_BACK_BELOW = 0.6;

/** Whether to offer easing back in after this week, and why. */
export function easeBackOffer(review: WeekReview): { reason: "time-off" | "missed" } | null {
  if (review.plannedRunMinutes === 0) return null;
  const share = review.doneRunMinutes / review.plannedRunMinutes;
  if (share >= EASE_BACK_BELOW || review.skipped.length + review.missed < 2) return null;
  const timeOff = review.skipped.some((r) => r === "illness" || r === "holiday" || r === "injury");
  return { reason: timeOff ? "time-off" : "missed" };
}

/** Where an eased-back plan starts: this week if nothing in it has happened yet, otherwise next Monday. */
export function easeBackStart(thisWeek: WeekPlan, checkIns: Record<string, CheckIn>, stored: boolean): string {
  const touched = stored || thisWeek.sessions.some((s) => checkIns[sessionKey(s.date, s.slot)]);
  return touched ? addDays(thisWeek.weekStart, 7) : thisWeek.weekStart;
}
