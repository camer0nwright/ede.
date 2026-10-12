// Each rule takes the proposed week plus context and returns the problems it
// finds. Messages are written so they can be sent back to the AI as-is.
import type { Availability, Phase, PlannedSession, WeekPlan } from "@/lib/domain";
import { DAY_NAMES, isHeavyLowerBody } from "@/lib/domain";
import { CHECKER_CONFIG as C } from "./config";
import { addDays, dayOfWeek, daysBetween } from "@/lib/dates";

export type RuleId =
  | "week-structure"
  | "rest-day"
  | "fits-availability"
  | "double-day"
  | "heavy-legs-before-key-run"
  | "easy-running"
  | "load-progression"
  | "recovery-week"
  | "taper"
  | "recalc-cap";

export type Violation = { rule: RuleId; message: string; date?: string };

/** A past week, oldest first, for progression and recovery rules. */
export type PastWeek = {
  totalMinutes: number;
  phase: Phase;
};

export type CheckContext = {
  availability: Availability;
  /** The weeks immediately before this one, oldest first. Empty for week 1. */
  history: PastWeek[];
  /** Race or goal date (YYYY-MM-DD), if the athlete set one. */
  targetDate?: string;
  /** The version of this week before a recalculation, if this is one. */
  previousVersion?: WeekPlan;
};

export type Rule = (week: WeekPlan, ctx: CheckContext) => Violation[];

// ---------- helpers ----------

const label = (date: string) => `${DAY_NAMES[dayOfWeek(date)]} ${date}`;

export const totalMinutes = (week: WeekPlan) =>
  week.sessions.reduce((sum, s) => sum + s.plannedMinutes, 0);

function sessionsByDate(week: WeekPlan) {
  const map = new Map<string, PlannedSession[]>();
  for (const s of week.sessions) {
    map.set(s.date, [...(map.get(s.date) ?? []), s]);
  }
  return map;
}

// Step 3c redefines a key run as a hard or long run (SPEC decision 5).
const isKeyRun = (s: PlannedSession) => s.type === "run" && s.isKeySession;
const isHeavyLegs = isHeavyLowerBody;

const isRecovery = (w: { phase: Phase }) => w.phase === "recovery";
const isTaper = (w: { phase: Phase }) => w.phase === "taper";

/** The most recent full build week: not recovery, not taper. */
function lastBuildWeek(history: PastWeek[]) {
  return history.findLast((w) => !isRecovery(w) && !isTaper(w));
}

/** Build weeks in a row immediately before this one. */
function buildStreak(history: PastWeek[]) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (isRecovery(history[i]) || isTaper(history[i])) break;
    streak++;
  }
  return streak;
}

/** 0 for race week, 1 for the week before, null outside the taper. */
function taperWeeksOut(week: WeekPlan, targetDate?: string) {
  if (!targetDate) return null;
  const days = daysBetween(week.weekStart, targetDate);
  if (days >= 0 && days <= 6) return 0;
  if (days >= 7 && days <= 13) return 1;
  return null;
}

// ---------- rules ----------

/** The week starts on a Monday, sessions fall inside it, and no day is overfull. */
export const weekStructure: Rule = (week) => {
  const out: Violation[] = [];
  if (dayOfWeek(week.weekStart) !== 0) {
    out.push({ rule: "week-structure", message: `The week must start on a Monday, not ${label(week.weekStart)}.` });
  }
  const weekEnd = addDays(week.weekStart, 6);
  for (const s of week.sessions) {
    if (s.date < week.weekStart || s.date > weekEnd) {
      out.push({ rule: "week-structure", date: s.date, message: `"${s.title}" on ${s.date} is outside the week ${week.weekStart} to ${weekEnd}.` });
    }
  }
  for (const [date, sessions] of sessionsByDate(week)) {
    if (sessions.length > 2) {
      out.push({ rule: "week-structure", date, message: `${label(date)} has ${sessions.length} sessions; a day can hold at most two.` });
    }
    const slots = sessions.map((s) => s.slot);
    if (new Set(slots).size !== slots.length) {
      out.push({ rule: "week-structure", date, message: `${label(date)} has two sessions in the same slot.` });
    }
  }
  return out;
};

/** At least one day of the week has no sessions at all. */
export const restDay: Rule = (week) => {
  const trainingDays = new Set(week.sessions.map((s) => s.date)).size;
  return trainingDays >= 7
    ? [{ rule: "rest-day", message: "The week needs at least one full rest day with no sessions." }]
    : [];
};

/** Sessions only on available days, within the time set, and two only on double days. */
export const fitsAvailability: Rule = (week, { availability }) => {
  const out: Violation[] = [];
  const cap = (m: number) => (m >= C.openEndedMinutes ? Infinity : m);
  for (const [date, sessions] of sessionsByDate(week)) {
    const day = availability[dayOfWeek(date)];
    if (day.minutes === null) {
      out.push({ rule: "fits-availability", date, message: `${label(date)} is a rest day in the athlete's availability, but sessions were planned.` });
      continue;
    }
    if (sessions.length === 2 && !day.isDouble) {
      out.push({ rule: "fits-availability", date, message: `${label(date)} is not a double day, so it can only hold one session.` });
    }
    for (const s of sessions) {
      if (s.slot === 2 && !day.isDouble) {
        if (sessions.length === 1) {
          out.push({ rule: "fits-availability", date, message: `"${s.title}" on ${label(date)} uses the second slot, which only double days have.` });
        }
        continue;
      }
      const limit = s.slot === 2 ? (day.secondMinutes ?? 0) : day.minutes;
      if (s.plannedMinutes > cap(limit)) {
        out.push({ rule: "fits-availability", date, message: `"${s.title}" on ${label(date)} is ${s.plannedMinutes} min but only ${limit} min is available.` });
      }
    }
  }
  return out;
};

/** Double days are one run plus one lift, never both hard, and no heavy legs with a key run. */
export const doubleDay: Rule = (week) => {
  const out: Violation[] = [];
  for (const [date, sessions] of sessionsByDate(week)) {
    if (sessions.length !== 2) continue;
    const types = sessions.map((s) => s.type).sort().join("+");
    if (types !== "run+strength") {
      out.push({ rule: "double-day", date, message: `The double day on ${label(date)} must be one run and one strength session, not ${types}.` });
    }
    if (sessions.every((s) => s.intensity === "hard")) {
      out.push({ rule: "double-day", date, message: `The double day on ${label(date)} has two hard sessions; make at least one easy or moderate.` });
    }
    if (sessions.some(isKeyRun) && sessions.some(isHeavyLegs)) {
      out.push({ rule: "double-day", date, message: `The double day on ${label(date)} pairs a key run with heavy legs; move the heavy legs session.` });
    }
  }
  return out;
};

/** No heavy leg session the day before a key run. */
export const heavyLegsBeforeKeyRun: Rule = (week) => {
  const out: Violation[] = [];
  const byDate = sessionsByDate(week);
  for (const s of week.sessions) {
    if (!isKeyRun(s)) continue;
    const dayBefore = addDays(s.date, -1);
    if ((byDate.get(dayBefore) ?? []).some(isHeavyLegs)) {
      out.push({ rule: "heavy-legs-before-key-run", date: dayBefore, message: `Heavy legs on ${label(dayBefore)} is the day before the key run "${s.title}"; move one of them.` });
    }
  }
  return out;
};

/** At least 80% of running minutes are in easy runs. */
export const easyRunning: Rule = (week) => {
  const runs = week.sessions.filter((s) => s.type === "run");
  const total = runs.reduce((sum, s) => sum + s.plannedMinutes, 0);
  if (total === 0) return [];
  const easy = runs.filter((s) => s.intensity === "easy").reduce((sum, s) => sum + s.plannedMinutes, 0);
  const share = easy / total;
  return share + 1e-9 < C.minEasyRunShare
    ? [{ rule: "easy-running", message: `Only ${Math.round(share * 100)}% of running time is easy (${easy} of ${total} min); at least ${C.minEasyRunShare * 100}% must be.` }]
    : [];
};

/** Build weeks grow gradually from the last build week. */
export const loadProgression: Rule = (week, { history, targetDate }) => {
  if (isRecovery(week) || isTaper(week) || taperWeeksOut(week, targetDate) !== null) return [];
  const ref = lastBuildWeek(history);
  if (!ref) return [];
  const limit = ref.totalMinutes + Math.max(ref.totalMinutes * C.maxLoadIncreaseShare, C.minLoadIncreaseMinutes);
  const total = totalMinutes(week);
  return total > limit
    ? [{ rule: "load-progression", message: `This week is ${total} min, up from ${ref.totalMinutes} min; build gradually to at most ${Math.floor(limit)} min.` }]
    : [];
};

/** A recovery week every 3-4 weeks, and recovery weeks are actually lighter. */
export const recoveryWeek: Rule = (week, { history, targetDate }) => {
  if (isTaper(week) || taperWeeksOut(week, targetDate) !== null) return [];
  const out: Violation[] = [];
  const streak = buildStreak(history);
  if (!isRecovery(week) && streak >= C.maxBuildWeeksInRow) {
    out.push({ rule: "recovery-week", message: `After ${streak} build weeks in a row, this must be a recovery week.` });
  }
  if (isRecovery(week)) {
    if (streak < C.minBuildWeeksBeforeRecovery) {
      out.push({ rule: "recovery-week", message: `A recovery week is too soon after ${streak} build week(s); it should come every 3-4 weeks.` });
    }
    const ref = lastBuildWeek(history);
    if (ref) {
      const limit = ref.totalMinutes * C.maxRecoveryWeekShare;
      const total = totalMinutes(week);
      if (total > limit) {
        out.push({ rule: "recovery-week", message: `This recovery week is ${total} min; it should be at most ${Math.floor(limit)} min (${C.maxRecoveryWeekShare * 100}% of the last build week).` });
      }
    }
  }
  return out;
};

/** With a target date, the last two weeks are taper weeks with reduced load. */
export const taper: Rule = (week, { history, targetDate }) => {
  const weeksOut = taperWeeksOut(week, targetDate);
  if (weeksOut === null) {
    return isTaper(week)
      ? [{ rule: "taper", message: "This is marked as a taper week (phase \"taper\") but it is not in the two weeks before the target date." }]
      : [];
  }
  const out: Violation[] = [];
  if (!isTaper(week)) {
    out.push({ rule: "taper", message: `The target date is ${targetDate}, so this week must be a taper week.` });
  }
  const ref = lastBuildWeek(history);
  if (ref) {
    const share = weeksOut === 0 ? C.maxRaceWeekShare : C.maxTaperWeekShare;
    const limit = ref.totalMinutes * share;
    const total = totalMinutes(week);
    if (total > limit) {
      const which = weeksOut === 0 ? "Race week" : "The week before race week";
      out.push({ rule: "taper", message: `${which} is ${total} min; it should be at most ${Math.floor(limit)} min (${share * 100}% of the last full week).` });
    }
  }
  return out;
};

/** A recalculation may only add or harden a few sessions and must not add much load. */
export const recalcCap: Rule = (week, { previousVersion }) => {
  if (!previousVersion) return [];
  const out: Violation[] = [];
  const rank = { easy: 0, moderate: 1, hard: 2 } as const;
  const key = (s: PlannedSession) => `${s.date}#${s.slot}`;
  const before = new Map(previousVersion.sessions.map((s) => [key(s), s]));

  const increased = week.sessions.filter((s) => {
    const old = before.get(key(s));
    if (!old) return true;
    return (
      old.type !== s.type ||
      rank[s.intensity] > rank[old.intensity] ||
      s.plannedMinutes > old.plannedMinutes
    );
  });
  if (increased.length > C.maxSessionsIncreasedPerRecalc) {
    out.push({ rule: "recalc-cap", message: `${increased.length} sessions were added or made harder; a recalculation may change at most ${C.maxSessionsIncreasedPerRecalc}. Removing or easing sessions is always allowed.` });
  }

  const oldTotal = totalMinutes(previousVersion);
  const limit = oldTotal * (1 + C.maxRecalcLoadIncreaseShare);
  const total = totalMinutes(week);
  if (total > limit) {
    out.push({ rule: "recalc-cap", message: `The recalculated week is ${total} min, up from ${oldTotal} min; it can grow by at most ${C.maxRecalcLoadIncreaseShare * 100}% (${Math.floor(limit)} min). Do not cram in missed sessions.` });
  }
  return out;
};

export const ALL_RULES: Rule[] = [
  weekStructure,
  restDay,
  fitsAvailability,
  doubleDay,
  heavyLegsBeforeKeyRun,
  easyRunning,
  loadProgression,
  recoveryWeek,
  taper,
  recalcCap,
];
