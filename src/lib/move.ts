// Moving a session to another day of its week (SPEC decision 48): to an empty
// day, swapping with the session already there, or doing both that day (a
// double day, at most two sessions). Only sessions not yet done, skipped or
// started can move, and only to today or later.
import { addDays, dayOfWeek } from "./dates";
import { DAY_NAMES, type PlannedSession, type WeekPlan } from "./domain";

export type MoveMode = "move" | "swap" | "both";
export type SessionRef = { date: string; slot: 1 | 2 };

export type MoveTarget = {
  date: string;
  dayName: string;
  /** Sessions already on that day. */
  sessions: { title: string; type: PlannedSession["type"]; locked: boolean }[];
  /** What a move there can do: nothing (past, full or its own day), move, or swap/both. */
  modes: MoveMode[];
};

const same = (s: PlannedSession, ref: SessionRef) => s.date === ref.date && s.slot === ref.slot;

/**
 * Every day of the week as a place the session could go. `locked` sessions
 * (done, skipped or started) can't be swapped, and a day already holding two
 * sessions is full.
 */
type Placeable = { date: string; slot: number; title: string; type: PlannedSession["type"] };

export function moveTargets<S extends Placeable>(
  week: { weekStart: string; sessions: S[] },
  from: SessionRef,
  today: string,
  isLocked: (s: S) => boolean,
): MoveTarget[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week.weekStart, i);
    const here = week.sessions.filter((s) => s.date === date);
    let modes: MoveMode[] = [];
    if (date >= today && date !== from.date) {
      if (here.length === 0) modes = ["move"];
      else if (here.length === 1) modes = isLocked(here[0]) ? ["both"] : ["swap", "both"];
    }
    return {
      date,
      dayName: DAY_NAMES[dayOfWeek(date)],
      sessions: here.map((s) => ({ title: s.title, type: s.type, locked: isLocked(s) })),
      modes,
    };
  });
}

type Placed = { session: PlannedSession; was: SessionRef };

/** Slots 1 and 2 in a stable order on each day: a run before a lift, otherwise as they were. */
function renumber(placed: Placed[]): Placed[] {
  const byDate = new Map<string, Placed[]>();
  for (const p of placed) byDate.set(p.session.date, [...(byDate.get(p.session.date) ?? []), p]);
  return [...byDate.values()].flatMap((day) =>
    day
      .sort((a, b) => (a.session.type === b.session.type ? a.session.slot - b.session.slot : a.session.type === "run" ? -1 : 1))
      .map((p, i) => ({ ...p, session: { ...p.session, slot: (i + 1) as 1 | 2 } })),
  );
}

const RUN_THEN_LIFT = "Run first, then lift at least 6 hours later.";

/**
 * The week with one session moved. Day notes follow what's now on each day:
 * a run and a lift on the same day get the "run first" note, and notes on
 * days that changed are otherwise dropped.
 */
export function applyMove(week: WeekPlan, from: SessionRef, to: string, mode: MoveMode): WeekPlan {
  return planMove(week, from, to, mode).week;
}

/** The moved week, plus every session whose day or slot changed (to update stored sessions). */
export function planMove(week: WeekPlan, from: SessionRef, to: string, mode: MoveMode): { week: WeekPlan; changes: { from: SessionRef; to: SessionRef }[] } {
  const moving = week.sessions.find((s) => same(s, from));
  if (!moving) throw new Error("That session isn't in this week.");
  const there = week.sessions.filter((s) => s.date === to);
  if (mode === "move" && there.length > 0) throw new Error("That day already has a session.");
  if (mode === "swap" && there.length !== 1) throw new Error("Swapping needs exactly one session on that day.");
  if (mode === "both" && there.length >= 2) throw new Error("A day can hold at most two sessions.");

  const placed = renumber(
    week.sessions.map((s) => ({
      was: { date: s.date, slot: s.slot },
      session: same(s, from)
        ? { ...s, date: to, slot: (mode === "both" ? 2 : 1) as 1 | 2 }
        : mode === "swap" && s.date === to
          ? { ...s, date: from.date, slot: from.slot }
          : s,
    })),
  ).sort((a, b) => (a.session.date === b.session.date ? a.session.slot - b.session.slot : a.session.date < b.session.date ? -1 : 1));
  const renumbered = placed.map((p) => p.session);

  const changed = new Set([from.date, to]);
  const dayNotes: Record<string, string> = {};
  for (const [date, note] of Object.entries(week.dayNotes)) if (!changed.has(date)) dayNotes[date] = note;
  for (const date of changed) {
    const types = new Set(renumbered.filter((s) => s.date === date).map((s) => s.type));
    if (types.has("run") && types.has("strength")) dayNotes[date] = RUN_THEN_LIFT;
  }
  const changes = placed
    .filter((p) => p.was.date !== p.session.date || p.was.slot !== p.session.slot)
    .map((p) => ({ from: p.was, to: { date: p.session.date, slot: p.session.slot } }));
  return { week: { ...week, sessions: renumbered, dayNotes }, changes };
}
