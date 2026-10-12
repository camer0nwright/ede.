// Each rule takes the proposed week plus context and returns the problems it
// finds. Messages are written so they can be sent back to the AI as-is.
import type {
  Availability,
  ExperienceLevel,
  Phase,
  PlannedSession,
  RunKind,
  StrengthVolume,
  WeekPlan,
} from "@/lib/domain";
import { DAY_NAMES, EASY_MAX_RPE, easyRunMinutes, isHeavyLowerBody } from "@/lib/domain";
import { addDays, dayOfWeek, daysBetween } from "@/lib/dates";
import { RUN_LIBRARY, runLabel } from "@/lib/session-library";
import { CHECKER_CONFIG as C } from "./config";

export type RuleId =
  | "week-structure"
  | "rest-day"
  | "fits-availability"
  | "double-day"
  | "heavy-legs-near-key-run"
  | "consecutive-hard-runs"
  | "lower-body-after-key-run"
  | "easy-running"
  | "beginner-easy-running"
  | "working-sets"
  | "strength-effort"
  | "consecutive-heavy-legs"
  | "run-progression"
  | "recovery-week"
  | "taper"
  | "session-variety"
  | "recalc-cap";

export type Violation = { rule: RuleId; message: string; date?: string };

/** A past week, oldest first, for progression, recovery and taper rules. */
export type PastWeek = {
  totalMinutes: number;
  runMinutes: number;
  phase: Phase;
  /** The week's quality sessions (library kind and level), when known. */
  quality?: { kind: RunKind; level: number }[];
};

export type CheckContext = {
  availability: Availability;
  /** The weeks immediately before this one, oldest first. Empty for week 1. */
  history: PastWeek[];
  /** Race or goal date (YYYY-MM-DD), if the athlete set one. */
  targetDate?: string;
  /** Defaults to "intermediate". */
  experienceLevel?: ExperienceLevel;
  /** Defaults to "low", the recommended setting for hybrid athletes. */
  strengthVolume?: StrengthVolume;
  /** For ultra races: the race distance, which sets the taper length. */
  ultraDistanceKm?: number;
  /** The version of this week before a recalculation, if this is one. */
  previousVersion?: WeekPlan;
};

export type Rule = (week: WeekPlan, ctx: CheckContext) => Violation[];

// ---------- helpers ----------

const label = (date: string) => `${DAY_NAMES[dayOfWeek(date)]} ${date}`;

export const totalMinutes = (week: WeekPlan) =>
  week.sessions.reduce((sum, s) => sum + s.plannedMinutes, 0);

export const runMinutes = (week: WeekPlan) =>
  week.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0);

function sessionsByDate(week: WeekPlan) {
  const map = new Map<string, PlannedSession[]>();
  for (const s of week.sessions) {
    map.set(s.date, [...(map.get(s.date) ?? []), s]);
  }
  return map;
}

/**
 * Long runs (SPEC decision 3): the week's longest run if it is 60+ minutes.
 * For back-to-back long runs, a 60+ minute run the day before or after it
 * counts as a long run too.
 */
export function longRuns(week: WeekPlan): PlannedSession[] {
  const runs = week.sessions.filter((s) => s.type === "run");
  const longest = Math.max(0, ...runs.map((r) => r.plannedMinutes));
  if (longest < C.longRunMinMinutes) return [];
  const anchors = runs.filter((r) => r.plannedMinutes === longest);
  const nearAnchor = (r: PlannedSession) =>
    anchors.some((a) => Math.abs(daysBetween(a.date, r.date)) === 1);
  return runs.filter(
    (r) => anchors.includes(r) || (r.plannedMinutes >= C.longRunMinMinutes && nearAnchor(r)),
  );
}

/** Key runs (SPEC decision 5): hard runs and long runs. */
export function keyRuns(week: WeekPlan): PlannedSession[] {
  const long = longRuns(week);
  return week.sessions.filter(
    (s) => s.type === "run" && (s.intensity === "hard" || long.includes(s)),
  );
}

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

/** Load caps for each taper week; 100-mile ultras taper for 3 weeks. */
function taperShares(ctx: CheckContext): readonly number[] {
  return (ctx.ultraDistanceKm ?? 0) >= C.longUltraMinKm ? C.longUltraTaperShares : C.taperShares;
}

/** 0 for race week, 1 for the week before, and so on; null outside the taper. */
function taperWeeksOut(week: WeekPlan, ctx: CheckContext) {
  if (!ctx.targetDate) return null;
  const days = daysBetween(week.weekStart, ctx.targetDate);
  if (days < 0) return null;
  const weeksOut = Math.floor(days / 7);
  return weeksOut < taperShares(ctx).length ? weeksOut : null;
}

const inTaperWindow = (week: WeekPlan, ctx: CheckContext) => taperWeeksOut(week, ctx) !== null;

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

/** Double days are one run plus one lift and never two hard sessions. */
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
  }
  return out;
};

/** No heavy lower-body session the day before, or the same day as, a hard or long run. */
export const heavyLegsNearKeyRun: Rule = (week) => {
  const out: Violation[] = [];
  const byDate = sessionsByDate(week);
  for (const run of keyRuns(week)) {
    const dayBefore = addDays(run.date, -1);
    if ((byDate.get(dayBefore) ?? []).some(isHeavyLowerBody)) {
      out.push({ rule: "heavy-legs-near-key-run", date: dayBefore, message: `Heavy lower-body lifting on ${label(dayBefore)} is the day before the hard or long run "${run.title}"; make it upper body or move it.` });
    }
    if ((byDate.get(run.date) ?? []).some(isHeavyLowerBody)) {
      out.push({ rule: "heavy-legs-near-key-run", date: run.date, message: `Heavy lower-body lifting on ${label(run.date)} is the same day as the hard or long run "${run.title}"; make it upper body or move it.` });
    }
  }
  return out;
};

/**
 * No hard run the day after a hard run. Strength sessions may be on
 * consecutive days, and a hard lift may follow a hard run (legs are covered
 * by the heavy-legs and lower-body-after-key-run rules).
 */
export const consecutiveHardRuns: Rule = (week) => {
  const out: Violation[] = [];
  const hardRunDates = new Set(
    week.sessions.filter((s) => s.type === "run" && s.intensity === "hard").map((s) => s.date),
  );
  for (const date of [...hardRunDates].sort()) {
    const next = addDays(date, 1);
    if (hardRunDates.has(next)) {
      out.push({ rule: "consecutive-hard-runs", date: next, message: `Hard runs on ${label(date)} and ${label(next)} are on consecutive days; separate them.` });
    }
  }
  return out;
};

/** Lower-body lifting the day after a hard or long run stays at RPE 8 or less. */
export const lowerBodyAfterKeyRun: Rule = (week) => {
  const out: Violation[] = [];
  const byDate = sessionsByDate(week);
  for (const run of keyRuns(week)) {
    const dayAfter = addDays(run.date, 1);
    for (const s of byDate.get(dayAfter) ?? []) {
      if (s.type !== "strength" || s.bodyFocus === "upper") continue;
      // Until the exercise library exists, every exercise in a full-body session
      // is treated as possibly lower-body (SPEC decision 4).
      const tooHard = s.exercises.filter((e) => e.targetRpe > C.maxLowerRpeAfterKeyRun);
      if (tooHard.length > 0) {
        out.push({ rule: "lower-body-after-key-run", date: dayAfter, message: `"${s.title}" on ${label(dayAfter)} is the day after the hard or long run "${run.title}"; prefer upper body, or keep lower-body work at RPE ${C.maxLowerRpeAfterKeyRun} or less (${tooHard.map((e) => e.name).join(", ")} ${tooHard.length === 1 ? "is" : "are"} higher).` });
      }
    }
  }
  return out;
};

/**
 * At least 80% of running minutes are at easy effort (SPEC decision 17):
 * counted step by step, so warm-ups, cool-downs and the easy part of a
 * fast-finish long run count as easy.
 */
export const easyRunning: Rule = (week) => {
  const runs = week.sessions.filter((s) => s.type === "run");
  const total = runs.reduce((sum, s) => sum + s.plannedMinutes, 0);
  if (total === 0) return [];
  const easy = runs.reduce((sum, s) => sum + easyRunMinutes(s), 0);
  const share = easy / total;
  return share + 1e-9 < C.minEasyRunShare
    ? [{ rule: "easy-running", message: `Only ${Math.round(share * 100)}% of running time is at easy effort, RPE ${EASY_MAX_RPE} or less (${Math.round(easy)} of ${total} min); at least ${C.minEasyRunShare * 100}% must be.` }]
    : [];
};

/** Beginners run easy only (run/walk), with no moderate or hard runs. */
export const beginnerEasyRunning: Rule = (week, { experienceLevel }) => {
  if (experienceLevel !== "beginner") return [];
  return week.sessions
    .filter((s) => s.type === "run" && s.intensity !== "easy")
    .map((s) => ({
      rule: "beginner-easy-running" as const,
      date: s.date,
      message: `"${s.title}" on ${label(s.date)} is ${s.intensity}; beginners run easy only, using run/walk intervals.`,
    }));
};

/** No heavy lower-body sessions on consecutive days. */
export const consecutiveHeavyLegs: Rule = (week) => {
  const out: Violation[] = [];
  const heavyDates = new Set(week.sessions.filter(isHeavyLowerBody).map((s) => s.date));
  for (const date of [...heavyDates].sort()) {
    const next = addDays(date, 1);
    if (heavyDates.has(next)) {
      out.push({ rule: "consecutive-heavy-legs", date: next, message: `Heavy lower-body sessions on ${label(date)} and ${label(next)} are on consecutive days; make one of them upper body or move it.` });
    }
  }
  return out;
};

/**
 * Most lifting is hard: in each strength session, most exercises are at or
 * above the strength volume setting's lowest RPE. Skipped for beginners, in
 * recovery and taper weeks, and for lower-body work capped after a key run.
 */
export const strengthEffort: Rule = (week, { strengthVolume = "low", experienceLevel }) => {
  if (experienceLevel === "beginner" || isRecovery(week) || isTaper(week)) return [];
  const minRpe = C.hardLiftMinRpe[strengthVolume];
  const keyRunDates = new Set(keyRuns(week).map((r) => r.date));
  const out: Violation[] = [];
  for (const s of week.sessions) {
    if (s.type !== "strength" || s.exercises.length === 0) continue;
    const cappedAfterKeyRun = s.bodyFocus !== "upper" && keyRunDates.has(addDays(s.date, -1));
    if (cappedAfterKeyRun) continue;
    const hard = s.exercises.filter((e) => e.targetRpe >= minRpe).length;
    if (hard / s.exercises.length <= C.minHardExerciseShare) {
      out.push({ rule: "strength-effort", date: s.date, message: `Only ${hard} of ${s.exercises.length} exercises in "${s.title}" on ${label(s.date)} are at RPE ${minRpe}+; most lifts should be hard on ${strengthVolume} strength volume.` });
    }
  }
  return out;
};

/** Every strength exercise has the working sets for the athlete's strength volume. */
export const workingSets: Rule = (week, { strengthVolume = "low" }) => {
  const { min, max } = C.workingSets[strengthVolume];
  const want = min === max ? `exactly ${min}` : `${min}-${max}`;
  const out: Violation[] = [];
  for (const s of week.sessions) {
    if (s.type !== "strength") continue;
    for (const e of s.exercises) {
      if (e.workingSets < min || e.workingSets > max) {
        out.push({ rule: "working-sets", date: s.date, message: `${e.name} in "${s.title}" on ${label(s.date)} has ${e.workingSets} working sets; ${strengthVolume} strength volume needs ${want}.` });
      }
    }
  }
  return out;
};

/**
 * Run minutes grow by at most about 10% on the last build week (strength
 * minutes don't count). When last week's run minutes are unknown or under 60,
 * the starting-load range applies instead.
 */
export const runProgression: Rule = (week, ctx) => {
  if (isRecovery(week) || isTaper(week) || inTaperWindow(week, ctx)) return [];
  const run = runMinutes(week);
  const last = ctx.history.at(-1);

  if (!last || last.runMinutes < C.startingLoadBelowMinutes) {
    const out: Violation[] = [];
    const isBeginner = ctx.experienceLevel === "beginner";
    const range = isBeginner ? C.startingRunMinutes.beginner : C.startingRunMinutes.other;
    const who = isBeginner ? "a beginner (run/walk)" : "this athlete";
    if (run < range.min || run > range.max) {
      out.push({ rule: "run-progression", message: `This is a starting week, so run minutes should be ${range.min}-${range.max} for ${who}, not ${run}.` });
    }
    const runs = week.sessions.filter((s) => s.type === "run").length;
    const n = C.startingRunSessions;
    if (runs < n.min || runs > n.max) {
      out.push({ rule: "run-progression", message: `This is a starting week, so split running across ${n.min}-${n.max} runs, not ${runs}.` });
    }
    return out;
  }

  const ref = lastBuildWeek(ctx.history) ?? last;
  const limit = ref.runMinutes + Math.max(ref.runMinutes * C.maxRunIncreaseShare, C.minRunIncreaseMinutes);
  return run > limit
    ? [{ rule: "run-progression", message: `This week has ${run} run minutes, up from ${ref.runMinutes}; build gradually to at most ${Math.floor(limit)}. Strength minutes don't count towards this.` }]
    : [];
};

/** A recovery week every 3-4 weeks, cutting total volume by at least 30%. */
export const recoveryWeek: Rule = (week, ctx) => {
  if (isTaper(week) || inTaperWindow(week, ctx)) return [];
  const out: Violation[] = [];
  const streak = buildStreak(ctx.history);
  if (!isRecovery(week) && streak >= C.maxBuildWeeksInRow) {
    out.push({ rule: "recovery-week", message: `After ${streak} build weeks in a row, this must be a recovery week.` });
  }
  if (isRecovery(week)) {
    if (streak < C.minBuildWeeksBeforeRecovery) {
      out.push({ rule: "recovery-week", message: `A recovery week is too soon after ${streak} build week(s); it should come every 3-4 weeks.` });
    }
    const ref = lastBuildWeek(ctx.history);
    if (ref) {
      const limit = ref.totalMinutes * C.maxRecoveryWeekShare;
      const total = totalMinutes(week);
      if (total > limit) {
        out.push({ rule: "recovery-week", message: `This recovery week is ${total} min; it should be at most ${Math.floor(limit)} min (at least ${Math.round((1 - C.maxRecoveryWeekShare) * 100)}% less than the last build week).` });
      }
    }
  }
  return out;
};

/** With a target date, the final weeks are taper weeks with reduced load. */
export const taper: Rule = (week, ctx) => {
  const weeksOut = taperWeeksOut(week, ctx);
  const length = taperShares(ctx).length;
  if (weeksOut === null) {
    return isTaper(week)
      ? [{ rule: "taper", message: `This is marked as a taper week (phase "taper") but it is not in the ${length} weeks before the target date.` }]
      : [];
  }
  const out: Violation[] = [];
  if (!isTaper(week)) {
    out.push({ rule: "taper", message: `The target date is ${ctx.targetDate}, so this week must be a taper week.` });
  }
  const ref = lastBuildWeek(ctx.history);
  if (ref) {
    const share = taperShares(ctx)[weeksOut];
    const limit = ref.totalMinutes * share;
    const total = totalMinutes(week);
    if (total > limit) {
      const which = weeksOut === 0 ? "Race week" : `${weeksOut} week${weeksOut === 1 ? "" : "s"} before race week, this week`;
      out.push({ rule: "taper", message: `${which} is ${total} min; it should be at most ${Math.floor(limit)} min (${Math.round(share * 100)}% of the last full week).` });
    }
  }
  return out;
};

/**
 * Sessions vary week to week (SPEC "Plan outline and session variety"): the
 * set of quality session kinds isn't the same as last week's, and a kind comes
 * back at the same or a higher level (except in recovery and taper weeks).
 * Only checks runs that carry a library kind.
 */
export const sessionVariety: Rule = (week, { history }) => {
  const out: Violation[] = [];
  const quality = week.sessions.filter(
    (s): s is Extract<PlannedSession, { type: "run" }> =>
      s.type === "run" && s.kind !== undefined && RUN_LIBRARY[s.kind].role === "quality",
  );
  const last = history.at(-1)?.quality;
  if (quality.length > 0 && last && last.length > 0) {
    const kinds = new Set(quality.map((s) => s.kind!));
    const lastKinds = new Set(last.map((q) => q.kind));
    if (kinds.size === lastKinds.size && [...kinds].every((k) => lastKinds.has(k))) {
      out.push({ rule: "session-variety", message: `Last week's quality sessions were ${[...lastKinds].map(runLabel).join(" and ")}; use a different session type this week.` });
    }
  }
  if (!isRecovery(week) && !isTaper(week)) {
    for (const s of quality) {
      if (s.level === undefined) continue;
      const previous = history.flatMap((w) => w.quality ?? []).findLast((q) => q.kind === s.kind);
      if (previous && s.level < previous.level) {
        out.push({ rule: "session-variety", date: s.date, message: `"${s.title}" on ${label(s.date)} is level ${s.level}, but ${runLabel(s.kind!)} was last done at level ${previous.level}; progress from there.` });
      }
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
  heavyLegsNearKeyRun,
  consecutiveHardRuns,
  lowerBodyAfterKeyRun,
  easyRunning,
  beginnerEasyRunning,
  workingSets,
  strengthEffort,
  consecutiveHeavyLegs,
  runProgression,
  recoveryWeek,
  taper,
  sessionVariety,
  recalcCap,
];
