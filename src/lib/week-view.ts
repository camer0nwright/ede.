// Turns a built week into what the week and session screens show: every day
// Monday to Sunday, each session with its purpose, tip and details.
import { sessionKey, type CheckIn } from "./checkin";
import { addDays, dayOfWeek } from "./dates";
import { DAY_NAMES, EASY_MAX_RPE, type BodyFocus, type Intensity, type PlannedSession, type RunStep, type WeekPlan } from "./domain";
import { defaultRestSeconds, findExercise } from "./exercise-library";
import { estimatedKm, formatEstimate, formatPaceBand, paceForRpe } from "./paces";
import { maxLevel, RUN_LIBRARY, RUN_PURPOSE, RUN_TIP } from "./session-library";

/** Pace guides from a recent race time (or an estimate, when `estimated`), in the athlete's distance unit. */
export type PaceOptions = { fiveKSeconds?: number; unit: "km" | "mi"; estimated?: boolean };

export type Effort = "easy" | "moderate" | "hard";

/** How a step's effort shows in colour: RPE 4 or less easy, 5-6 moderate, 7+ hard. */
export const effortOf = (rpe: number): Effort => (rpe <= EASY_MAX_RPE ? "easy" : rpe <= 6 ? "moderate" : "hard");

/** What every session view has: where it is in the week, and its check-in if there is one. */
type SessionBase = { id: string; date: string; slot: 1 | 2; checkIn?: CheckIn };

export type RunView = SessionBase & {
  type: "run";
  title: string;
  minutes: number;
  intensity: Intensity;
  roleLabel: string;
  level?: number;
  maxLevel?: number;
  purpose: string;
  tip: string;
  steps: (RunStep & { effort: Effort; paceName: string; pace?: string })[];
  /** "≈ 8.5 km": how far the run goes at its paces. */
  distance?: string;
  /** Paces come from an estimate, not a recent race time. */
  pacesEstimated?: boolean;
};

export type LiftView = SessionBase & {
  type: "strength";
  /** A logged workout for this session (started or finished). */
  workout?: { id: string; inProgress: boolean };
  title: string;
  minutes: number;
  focus: BodyFocus;
  purpose: string;
  tip: string;
  exercises: {
    name: string;
    warmupSets: number;
    workingSets: number;
    reps: string;
    targetRpe: number;
    failureAllowed: boolean;
    restSeconds: number;
    isMainLift: boolean;
  }[];
};

export type SessionView = RunView | LiftView;

export type DayView = { date: string; dayName: string; sessions: SessionView[]; note?: string };

const LIFT_PURPOSE: Record<BodyFocus, string> = {
  lower: "Builds leg strength and resilience, so running feels stronger and you stay injury-free.",
  upper: "Builds upper-body strength and posture without tiring your legs.",
  full: "Whole-body strength in one efficient session.",
};

function runView(s: Extract<PlannedSession, { type: "run" }>, dayName: string, paces?: PaceOptions, checkIn?: CheckIn): RunView {
  const kind = s.kind;
  const levels = kind ? maxLevel(kind) : 1;
  const role = kind ? RUN_LIBRARY[kind].role : "easy";
  return {
    type: "run",
    id: sessionKey(s.date, s.slot),
    date: s.date,
    slot: s.slot,
    ...(checkIn && { checkIn }),
    title: s.title,
    minutes: s.plannedMinutes,
    intensity: s.intensity,
    roleLabel: `${dayName} · ${role === "quality" ? "Key session" : role === "long" ? "Long run" : "Easy"}`,
    ...(kind && levels > 1 && { level: s.level, maxLevel: levels }),
    purpose: kind ? RUN_PURPOSE[kind] : "",
    tip: kind ? RUN_TIP[kind] : "",
    steps: s.steps.map((st) => ({
      ...st,
      effort: effortOf(st.targetRpe),
      paceName: paceForRpe(paces?.fiveKSeconds ?? 1500, st.targetRpe).name,
      ...(paces?.fiveKSeconds && { pace: formatPaceBand(paceForRpe(paces.fiveKSeconds, st.targetRpe), paces.unit) }),
    })),
    // About how far it goes, for planning a route (SPEC decision 73).
    ...(paces?.fiveKSeconds && s.steps.length > 0 && { distance: formatEstimate(estimatedKm(s.steps, paces.fiveKSeconds), paces.unit) }),
    ...(paces?.estimated && { pacesEstimated: true }),
  };
}

function liftView(s: Extract<PlannedSession, { type: "strength" }>, checkIn?: CheckIn, workout?: LiftView["workout"]): LiftView {
  const light = s.exercises.every((e) => e.targetRpe <= 7);
  return {
    type: "strength",
    id: sessionKey(s.date, s.slot),
    date: s.date,
    slot: s.slot,
    ...(checkIn && { checkIn }),
    title: s.title,
    minutes: s.plannedMinutes,
    focus: s.bodyFocus,
    ...(workout && { workout }),
    purpose: light ? "A lighter week: the same lifts with less effort, so you recover and come back stronger." : LIFT_PURPOSE[s.bodyFocus],
    tip: light
      ? "Keep every set smooth and comfortable, well short of your limit."
      : "Two working sets, both all-out: pick a weight you can just finish in the rep range. Heavy barbell lifts stop one rep short; everything else goes to failure.",
    exercises: s.exercises.map((e) => {
      const info = findExercise(e.name);
      return { ...e, restSeconds: info ? defaultRestSeconds(info) : 90, isMainLift: info?.isMainLift ?? false };
    }),
  };
}

export function weekDays(
  week: WeekPlan,
  paces?: PaceOptions,
  checkIns: Record<string, CheckIn> = {},
  workouts: Record<string, NonNullable<LiftView["workout"]>> = {},
): DayView[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week.weekStart, i);
    const dayName = DAY_NAMES[dayOfWeek(date)];
    const sessions = week.sessions
      .filter((s) => s.date === date)
      .sort((a, b) => a.slot - b.slot)
      .map((s) => {
        const checkIn = checkIns[sessionKey(s.date, s.slot)];
        return s.type === "run" ? runView(s, dayName, paces, checkIn) : liftView(s, checkIn, workouts[sessionKey(s.date, s.slot)]);
      });
    return { date, dayName, sessions, ...(week.dayNotes[date] && { note: week.dayNotes[date] }) };
  });
}
