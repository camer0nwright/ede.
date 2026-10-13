// Injuries: how bad one is (its band), and how a week changes around it from
// the day it's reported (SPEC: Injury and pain handling). Mild pain keeps easy,
// flat running, cut by 20% the first week and held after that. Moderate pain
// pauses running. Severe pain pauses running and leg work: upper body only.
// Lifts always avoid the injured area. The plan checker's injury rule checks
// the result.
import { addDays, daysBetween } from "./dates";
import type { BodyArea, Equipment, ExperienceLevel, Injury, PlannedSession, StrengthVolume, WeekPlan } from "./domain";
import { findExercise } from "./exercise-library";
import { keyRunFlags } from "./key-runs";
import { buildRunSteps, minMinutes, RUN_LIBRARY } from "./session-library";
import { buildStrengthSession } from "./strength-builder";

export const INJURY_BANDS = {
  /** Pain up to this level (during running or specific lifts only): reduced, easy running. */
  mildMax: 3,
  /** Pain up to this level: no running. Above it: no running and no lower-body lifting. */
  moderateMax: 6,
  /** Mild pain: run minutes at most this share of last week's (a 20-30% cut). */
  mildRunShare: 0.8,
  /** The first week back after an injury: at most this share of the last week before it. */
  returnRunShare: 0.8,
  /** Shortest run worth keeping when running is cut. */
  minRunMinutes: 20,
};

export type InjuryBand = "mild" | "moderate" | "severe";

/** Which injury band applies (SPEC: Injury and pain handling). */
export function injuryBand(injury: Injury): InjuryBand {
  const { mildMax, moderateMax } = INJURY_BANDS;
  if (injury.painLevel > moderateMax || injury.painWhen === "resting") return "severe";
  if (injury.painLevel > mildMax || injury.painWhen === "walking") return "moderate";
  return "mild";
}

const areaName = (area: BodyArea) => (area === "other" ? "injury" : area);

/** What the plan does for this injury, in a line. */
export function bandSummary(injury: Injury): string {
  const area = areaName(injury.area);
  return {
    mild: `Easy, flat running, a little less of it. Lifts avoid your ${area}.`,
    moderate: `Running is paused while your ${area} settles. Lifting carries on around it.`,
    severe: `Running and leg work are paused: upper body only, avoiding your ${area}.`,
  }[injuryBand(injury)];
}

/** The week's coach note while injured. Moderate and severe point to a physio or doctor (checker: injury). */
export function injuryCoachNote(injury: Injury): string {
  const area = areaName(injury.area);
  return {
    mild: `Your ${area} is niggling, so running stays easy and flat, and a little shorter. If it gets worse, update it in You.`,
    moderate: `Running is paused while your ${area} settles, and lifting works around it. A physio or doctor can help you get back sooner.`,
    severe: `Please see a doctor before training. Until then, ede. keeps you to upper-body work that avoids your ${area}.`,
  }[injuryBand(injury)];
}

export type InjuryAdaptInput = {
  injury: Injury;
  /** Sessions on or after this date change; earlier ones stay as they were. */
  from: string;
  /** Run minutes the week before (as adapted, if the injury was active then). */
  lastWeekRunMinutes?: number;
  /** The injury was already active last week, so running holds rather than being cut again. */
  ongoing: boolean;
  /** For rebuilding gym sessions. */
  strength: { volume: StrengthVolume; equipment: Equipment[]; block: number; avoidBarbell?: boolean };
};

type Run = Extract<PlannedSession, { type: "run" }>;
type Lift = Extract<PlannedSession, { type: "strength" }>;

const floor5 = (n: number) => Math.floor(n / 5) * 5;

/** A run as an easy, flat one of the given length: a long run stays a long easy run if it's long enough. */
function easyVersion(r: Run, minutes: number): Run {
  const wasLong = r.kind ? RUN_LIBRARY[r.kind].role === "long" : r.title.toLowerCase().includes("long");
  const keep = r.kind && RUN_LIBRARY[r.kind].intensity === "easy" && r.kind !== "long_hilly" && minutes >= minMinutes(r.kind, r.level ?? 1);
  const kind = keep ? r.kind! : wasLong && minutes >= minMinutes("long_easy", 1) ? "long_easy" : "easy";
  const level = keep ? (r.level ?? 1) : 1;
  return {
    ...r,
    title: RUN_LIBRARY[kind].label,
    intensity: "easy",
    isKeySession: false,
    plannedMinutes: minutes,
    kind,
    level,
    steps: buildRunSteps(kind, level, minutes),
  };
}

/** Mild pain: easy, flat runs within the week's budget, dropping the shortest if they'd get too short. */
function mildRuns(past: Run[], future: Run[], input: InjuryAdaptInput): Run[] {
  const last = input.lastWeekRunMinutes;
  const cap = last === undefined ? Infinity : Math.floor(last * (input.ongoing ? 1 : INJURY_BANDS.mildRunShare));
  const budget = cap - past.reduce((sum, r) => sum + r.plannedMinutes, 0);
  let runs = [...future];
  let minutes = runs.map((r) => r.plannedMinutes);
  while (runs.length > 0 && minutes.reduce((a, b) => a + b, 0) > budget) {
    const total = runs.reduce((sum, r) => sum + r.plannedMinutes, 0);
    const scaled = runs.map((r) => floor5((r.plannedMinutes * Math.max(0, budget)) / total));
    if (Math.min(...scaled) >= INJURY_BANDS.minRunMinutes) {
      minutes = scaled;
      break;
    }
    // Drop the shortest run and share its time among the rest.
    const shortest = runs.reduce((min, r, i) => (r.plannedMinutes < runs[min].plannedMinutes ? i : min), 0);
    runs = runs.filter((_, i) => i !== shortest);
    minutes = runs.map((r) => r.plannedMinutes);
  }
  return runs.map((r, i) => easyVersion(r, minutes[i]));
}

/** A gym session rebuilt to avoid the injured area (and upper body only for severe pain). */
function safeLift(s: Lift, focus: Lift["bodyFocus"], variant: "A" | "B", input: InjuryAdaptInput): Lift {
  const built = buildStrengthSession({
    focus,
    volume: input.strength.volume,
    effort: s.intensity === "hard" ? "hard" : "light",
    equipment: input.strength.equipment,
    block: input.strength.block,
    variant,
    avoid: input.injury.area,
    avoidBarbell: input.strength.avoidBarbell,
    maxMinutes: s.plannedMinutes,
    minExercises: 1,
  });
  return {
    ...s,
    title: { upper: "Upper body", lower: "Lower body", full: "Full body" }[focus],
    bodyFocus: focus,
    plannedMinutes: built.minutes,
    exercises: built.exercises.map((e) => ({ name: e.name, warmupSets: e.warmupSets, workingSets: e.workingSets, reps: e.reps, targetRpe: e.targetRpe, failureAllowed: e.failureAllowed })),
  };
}

/** Dates with a hard or long run, as the plan checker sees them. */
function keyRunDates(week: WeekPlan): Set<string> {
  const runs = week.sessions.filter((s) => s.type === "run");
  const flags = keyRunFlags(runs.map((r) => ({ minutes: r.plannedMinutes, day: daysBetween(week.weekStart, r.date), hard: r.intensity === "hard" })));
  return new Set(runs.filter((_, i) => flags[i]).map((r) => r.date));
}

const loadsArea = (s: Lift, area: BodyArea) => s.exercises.some((e) => findExercise(e.name)?.loads.includes(area));

/** The week changed around an injury, from `input.from` on. */
export function adaptWeekForInjury(week: WeekPlan, input: InjuryAdaptInput): WeekPlan {
  const band = injuryBand(input.injury);
  const isFuture = (s: PlannedSession) => s.date >= input.from;
  const runs = week.sessions.filter((s): s is Run => s.type === "run");
  const pastRuns = runs.filter((r) => !isFuture(r));
  const futureRuns = runs.filter(isFuture);
  const keptRuns = band === "mild" ? mildRuns(pastRuns, futureRuns, input) : [];

  let upperCount = 0;
  const sessions: PlannedSession[] = [];
  for (const s of week.sessions) {
    if (!isFuture(s)) sessions.push(s);
    else if (s.type === "run") {
      const kept = keptRuns.find((r) => r.date === s.date && r.slot === s.slot);
      if (kept) sessions.push(kept);
    } else if (band === "severe" && s.bodyFocus !== "upper") {
      sessions.push(safeLift(s, "upper", upperCount++ % 2 === 0 ? "B" : "A", input));
    } else if (loadsArea(s, input.injury.area)) {
      sessions.push(safeLift(s, s.bodyFocus, "A", input));
    } else sessions.push(s);
  }

  // Leg work was kept lighter the day after a hard or long run; if that run
  // has gone or eased, the session goes back to its normal effort.
  const keyBefore = keyRunDates(week);
  const keyAfter = keyRunDates({ ...week, sessions });
  sessions.forEach((s, i) => {
    if (s.type !== "strength" || !isFuture(s) || s.bodyFocus === "upper") return;
    const dayBefore = addDays(s.date, -1);
    if (keyBefore.has(dayBefore) && !keyAfter.has(dayBefore)) sessions[i] = safeLift(s, s.bodyFocus, "A", input);
  });

  // Keep day notes only for days that still have a run and a lift.
  const dayNotes = Object.fromEntries(
    Object.entries(week.dayNotes).filter(([date]) => date < input.from || (sessions.some((s) => s.date === date && s.type === "run") && sessions.some((s) => s.date === date && s.type === "strength"))),
  );
  return { ...week, sessions, dayNotes, coachNote: injuryCoachNote(input.injury) };
}

const weekRunMinutes = (w: WeekPlan) => w.sessions.reduce((sum, s) => sum + (s.type === "run" ? s.plannedMinutes : 0), 0);

/** Beginners stay off heavy barbell lifts for their first 8 weeks (as the week builder does). */
const BEGINNER_MACHINE_WEEKS = 8;

/**
 * Every week of a plan with an active injury applied from `since` (the day it
 * was reported) onwards. Weeks that ended before then are unchanged.
 */
export function adaptWeeksForInjury(
  weeks: WeekPlan[],
  opts: {
    injury: Injury;
    since: string;
    /** Run minutes the week before the plan started. */
    lastWeekRunMinutes?: number;
    /** Each week's strength block, in order (from the plan outline). */
    blocks: number[];
    volume: StrengthVolume;
    equipment: Equipment[];
    experienceLevel: ExperienceLevel;
  },
): { week: WeekPlan; injured: boolean }[] {
  let lastRun = opts.lastWeekRunMinutes;
  let lastInjured = false;
  return weeks.map((week, i) => {
    const injured = addDays(week.weekStart, 6) >= opts.since;
    const adapted = injured
      ? adaptWeekForInjury(week, {
          injury: opts.injury,
          from: opts.since > week.weekStart ? opts.since : week.weekStart,
          lastWeekRunMinutes: lastRun,
          ongoing: lastInjured,
          strength: {
            volume: opts.volume,
            equipment: opts.equipment,
            block: opts.blocks[i] ?? 1,
            avoidBarbell: opts.experienceLevel === "beginner" && week.weekNumber <= BEGINNER_MACHINE_WEEKS,
          },
        })
      : week;
    lastRun = weekRunMinutes(adapted);
    lastInjured = injured;
    return { week: adapted, injured };
  });
}
