// Converts between ede.'s own types and database rows. JSON columns are
// validated with Zod when read back, so bad data never reaches the plan checker.
import { z } from "zod";
import { toUtc } from "./dates";
import {
  Phase,
  PlannedSession,
  RunKind,
  RunStep,
  StrengthExercise,
  type WeekPlan,
} from "./domain";
import type { OnboardingAnswers } from "./onboarding";
import type { OutlineInput } from "./plan-outline";
import { defaultRestSeconds, failureAllowed, weightStepKg, type ExerciseInfo } from "./exercise-library";
import { RUN_LIBRARY } from "./session-library";

/** A date as stored: midnight UTC. */
export const toDbDate = (date: string) => new Date(toUtc(date));
/** A stored date back to YYYY-MM-DD. */
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

/** The Session columns ede. writes (everything except ids and check-in fields). */
export type SessionRow = {
  date: Date;
  slot: number;
  type: string;
  title: string;
  intensity: string;
  isKeySession: boolean;
  kind: string | null;
  level: number | null;
  steps: string | null;
  bodyFocus: string | null;
  exercises: string | null;
  plannedMinutes: number;
};

export function sessionToRow(s: PlannedSession): SessionRow {
  return {
    date: toDbDate(s.date),
    slot: s.slot,
    type: s.type,
    title: s.title,
    intensity: s.intensity,
    isKeySession: s.isKeySession,
    plannedMinutes: s.plannedMinutes,
    kind: s.type === "run" ? (s.kind ?? null) : null,
    level: s.type === "run" ? (s.level ?? null) : null,
    steps: s.type === "run" ? JSON.stringify(s.steps) : null,
    bodyFocus: s.type === "strength" ? s.bodyFocus : null,
    exercises: s.type === "strength" ? JSON.stringify(s.exercises) : null,
  };
}

const json = <T extends z.ZodType>(schema: T, text: string | null) =>
  text === null ? undefined : schema.parse(JSON.parse(text));

export function rowToSession(row: SessionRow): PlannedSession {
  const base = {
    date: fromDbDate(row.date),
    slot: row.slot,
    title: row.title,
    intensity: row.intensity,
    plannedMinutes: row.plannedMinutes,
    isKeySession: row.isKeySession,
  };
  return PlannedSession.parse(
    row.type === "run"
      ? {
          ...base,
          type: "run",
          steps: json(z.array(RunStep), row.steps) ?? [],
          ...(row.kind && { kind: row.kind }),
          ...(row.level && { level: row.level }),
        }
      : { ...base, type: "strength", bodyFocus: row.bodyFocus, exercises: json(z.array(StrengthExercise), row.exercises) ?? [] },
  );
}

/** The PlanWeek columns ede. writes for a checked week. */
export function weekToRow(week: WeekPlan) {
  const runs = week.sessions.filter((s) => s.type === "run");
  const quality = runs
    .filter((s) => s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality")
    .map((s) => (s.type === "run" ? { kind: s.kind!, level: s.level ?? 1 } : null));
  return {
    weekStart: toDbDate(week.weekStart),
    weekNumber: week.weekNumber,
    phase: week.phase,
    runMinutes: runs.reduce((sum, s) => sum + s.plannedMinutes, 0),
    strengthMinutes: week.sessions.filter((s) => s.type === "strength").reduce((sum, s) => sum + s.plannedMinutes, 0),
    quality: quality.length > 0 ? JSON.stringify(quality) : null,
    dayNotes: JSON.stringify(week.dayNotes),
    coachNote: week.coachNote || null,
  };
}

/** A stored week and its sessions back as a WeekPlan. */
export function rowToWeekPlan(row: {
  weekStart: Date;
  weekNumber: number;
  phase: string;
  dayNotes: string | null;
  coachNote: string | null;
  sessions: SessionRow[];
}): WeekPlan {
  return {
    weekStart: fromDbDate(row.weekStart),
    weekNumber: row.weekNumber,
    phase: Phase.parse(row.phase),
    sessions: [...row.sessions]
      .sort((x, y) => x.date.getTime() - y.date.getTime() || x.slot - y.slot)
      .map(rowToSession),
    dayNotes: json(z.record(z.string(), z.string()), row.dayNotes) ?? {},
    coachNote: row.coachNote ?? "",
  };
}

const Quality = z.array(z.object({ kind: RunKind, level: z.number().int().min(1) }));

/** A stored week as the plan checker's history entry (see PastWeek in the checker). */
export function rowToPastWeek(row: { runMinutes: number; strengthMinutes: number; phase: string; quality: string | null }) {
  return {
    totalMinutes: row.runMinutes + row.strengthMinutes,
    runMinutes: row.runMinutes,
    phase: Phase.parse(row.phase),
    ...(row.quality && { quality: Quality.parse(JSON.parse(row.quality)) }),
  };
}

/** A library exercise as an Exercise row. */
export function exerciseToRow(e: ExerciseInfo) {
  return {
    name: e.name,
    aliases: e.aliases ? JSON.stringify(e.aliases) : null,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    category: e.category,
    isLowerBody: e.isLowerBody,
    isMainLift: e.isMainLift ?? false,
    failureAllowed: failureAllowed(e),
    defaultRestSeconds: defaultRestSeconds(e),
    weightStepKg: weightStepKg(e),
    loads: JSON.stringify(e.loads),
    alternatives: JSON.stringify(e.alternatives),
  };
}

/** Weights are stored in kg and shown in the athlete's unit. */
export const LB_PER_KG = 2.20462;
export const toKg = (weight: number, unit: "kg" | "lb") => (unit === "kg" ? weight : weight / LB_PER_KG);
export const fromKg = (kg: number, unit: "kg" | "lb") => (unit === "kg" ? kg : kg * LB_PER_KG);

/** The Athlete columns that come from the setup answers (not name, units or injuries, which are saved separately). */
export function answersToAthleteRow(a: OnboardingAnswers, input: OutlineInput) {
  const race = a.goalType === "race";
  return {
    goalType: a.goalType,
    goalDetail: a.goalDetail || null,
    targetDate: input.targetDate ? toDbDate(input.targetDate) : null,
    raceDistance: input.raceDistance ?? null,
    ultraDistanceKm: input.ultraDistanceKm ?? null,
    elevationGainM: race ? (a.elevationGainM ?? null) : null,
    terrain: input.terrain ?? null,
    experienceLevel: a.experienceLevel,
    strengthVolume: a.strengthVolume,
    recent5kMinutes: a.recent5kSeconds ? a.recent5kSeconds / 60 : null,
    targetTimeSeconds: race && !a.justFinish ? (a.targetTimeSeconds ?? null) : null,
    justFinish: race && (a.justFinish ?? false),
    runsPerWeek: a.runsPerWeek,
    liftsPerWeek: a.liftsPerWeek,
    equipment: a.equipment.join(", "),
  };
}
