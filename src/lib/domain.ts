// Shared shapes for ede.'s training data. The database stores enums as strings,
// so everything that comes in (AI output, form input, rows) is validated here.
import { z } from "zod";
import { findExercise } from "./exercise-library";

export const SESSION_TYPES = ["run", "strength"] as const;
export const INTENSITIES = ["easy", "moderate", "hard"] as const;
export const SESSION_STATUSES = ["planned", "completed", "skipped"] as const;
export const SKIP_REASONS = [
  "injury",
  "illness",
  "holiday",
  "work_life",
  "fatigue",
  "other",
] as const;
export const GOAL_TYPES = ["race", "strength", "general"] as const;

export const SessionType = z.enum(SESSION_TYPES);
export const Intensity = z.enum(INTENSITIES);
export const SessionStatus = z.enum(SESSION_STATUSES);
export const SkipReason = z.enum(SKIP_REASONS);
export const GoalType = z.enum(GOAL_TYPES);

export type SessionType = z.infer<typeof SessionType>;
export type Intensity = z.infer<typeof Intensity>;
export type SessionStatus = z.infer<typeof SessionStatus>;
export type SkipReason = z.infer<typeof SkipReason>;
export type GoalType = z.infer<typeof GoalType>;

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const ExperienceLevel = z.enum(EXPERIENCE_LEVELS);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const STRENGTH_VOLUMES = ["low", "moderate", "high"] as const;
export const StrengthVolume = z.enum(STRENGTH_VOLUMES);
export type StrengthVolume = z.infer<typeof StrengthVolume>;

export const RACE_DISTANCES = ["5k", "10k", "half", "marathon", "ultra"] as const;
export const RaceDistance = z.enum(RACE_DISTANCES);
export type RaceDistance = z.infer<typeof RaceDistance>;

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"] as const;
export const Equipment = z.enum(EQUIPMENT);
export type Equipment = z.infer<typeof Equipment>;

export const BODY_AREAS = ["knee", "ankle", "hip", "back", "shoulder", "elbow", "other"] as const;
export const BodyArea = z.enum(BODY_AREAS);
export type BodyArea = z.infer<typeof BodyArea>;

/** When an injury hurts (SPEC: Injury input). */
export const PAIN_WHEN = ["running", "walking", "resting", "lifting_only"] as const;
export const PainWhen = z.enum(PAIN_WHEN);
export type PainWhen = z.infer<typeof PainWhen>;

/** An active injury: area, pain level 0-10 and when it hurts. */
export const Injury = z.object({
  area: BodyArea,
  painLevel: z.number().int().min(0).max(10),
  painWhen: PainWhen,
});
export type Injury = z.infer<typeof Injury>;

export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
export const SetType = z.enum(SET_TYPES);
export type SetType = z.infer<typeof SetType>;

export const WeightUnit = z.enum(["kg", "lb"]);
export const DistanceUnit = z.enum(["km", "mi"]);

export const TERRAINS = ["road", "trail", "mountain"] as const;
export const Terrain = z.enum(TERRAINS);
export type Terrain = z.infer<typeof Terrain>;

/** Every kind of run in the session library (src/lib/session-library.ts). */
export const RUN_KINDS = [
  "easy",
  "recovery",
  "strides",
  "run_walk",
  "long_easy",
  "long_fast_finish",
  "long_race_pace",
  "long_hilly",
  "intervals_short",
  "intervals_long",
  "tempo",
  "hills",
  "fartlek",
  "progression",
  "aerobic_power",
  "hill_hike",
] as const;
export const RunKind = z.enum(RUN_KINDS);
export type RunKind = z.infer<typeof RunKind>;

/** A calendar date as YYYY-MM-DD, with no time zone. */
export const IsoDate = z.iso.date();

// ---------- Session steps ----------

/**
 * What a gym session works (SPEC decision 75). Upper/Lower uses upper and
 * lower, Push/Pull/Legs uses push, pull and lower, Arnold uses chest_back,
 * shoulders_arms and lower, and Full body uses full.
 */
export const BODY_FOCUSES = ["upper", "lower", "full", "push", "pull", "chest_back", "shoulders_arms"] as const;
export const BodyFocus = z.enum(BODY_FOCUSES);
export type BodyFocus = z.infer<typeof BodyFocus>;

/** Sessions with no leg work at all. */
export const isUpperOnly = (focus: BodyFocus) => focus !== "lower" && focus !== "full";

/** How the gym week is split (SPEC decision 75). */
export const GYM_SPLITS = ["upper_lower", "ppl", "arnold", "full_body"] as const;
export const GymSplit = z.enum(GYM_SPLITS);
export type GymSplit = z.infer<typeof GymSplit>;

export const PHASES = ["base", "build", "peak", "taper", "recovery"] as const;
export const Phase = z.enum(PHASES);
export type Phase = z.infer<typeof Phase>;

/** One part of a run: warm-up, main set or cool-down. */
export const RunStep = z.object({
  name: z.string().min(1),
  minutes: z.number().positive(),
  targetRpe: z.number().min(1).max(10),
});
export type RunStep = z.infer<typeof RunStep>;

/** One exercise in a strength session. Warm-up sets are not working sets. */
export const StrengthExercise = z.object({
  name: z.string().min(1),
  warmupSets: z.number().int().min(0),
  workingSets: z.number().int().min(1),
  reps: z.string().min(1), // "5", "8-10", "30s"
  targetRpe: z.number().min(1).max(10),
  failureAllowed: z.boolean(),
});
export type StrengthExercise = z.infer<typeof StrengthExercise>;

// ---------- Planned sessions ----------

const sessionBase = {
  date: IsoDate,
  slot: z.union([z.literal(1), z.literal(2)]).default(1),
  title: z.string().min(1),
  intensity: Intensity,
  plannedMinutes: z.number().int().positive(),
  /** The AI's own "key session" marker. */
  isKeySession: z.boolean().default(false),
};

export const RunSession = z.object({
  ...sessionBase,
  type: z.literal("run"),
  steps: z.array(RunStep).default([]),
  /** Which library session this is, and its progression level, when known. */
  kind: RunKind.optional(),
  level: z.number().int().min(1).optional(),
});

export const StrengthSession = z.object({
  ...sessionBase,
  type: z.literal("strength"),
  bodyFocus: BodyFocus,
  exercises: z.array(StrengthExercise).default([]),
});

/** One planned session, as the app stores and checks it. */
export const PlannedSession = z.discriminatedUnion("type", [
  RunSession,
  StrengthSession,
]);
export type PlannedSession = z.infer<typeof PlannedSession>;

/** A week of sessions. Days with no sessions are rest days. */
export const WeekPlan = z.object({
  weekStart: IsoDate, // a Monday
  weekNumber: z.number().int().min(1).default(1),
  phase: Phase.default("base"),
  sessions: z.array(PlannedSession),
  /** Notes per day, keyed by date. */
  dayNotes: z.record(IsoDate, z.string()).default({}),
  coachNote: z.string().default(""),
});
export type WeekPlan = z.infer<typeof WeekPlan>;

// ---------- Check-in ----------

export const CheckIn = z
  .object({
    status: z.enum(["completed", "skipped"]),
    actualMinutes: z.number().int().positive().optional(),
    effort: z.number().int().min(1).max(10).optional(),
    notes: z.string().max(2000).optional(),
    skipReason: SkipReason.optional(),
  })
  .refine((c) => c.status !== "skipped" || c.skipReason, {
    message: "Pick a reason for skipping",
    path: ["skipReason"],
  });
export type CheckIn = z.infer<typeof CheckIn>;

// ---------- Weekly availability grid ----------

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Time options offered in the grid. 120 means "120+". */
export const MINUTE_OPTIONS = [30, 45, 60, 90, 120] as const;

/**
 * The top time option means "this much or more", so it has no upper limit:
 * 120 (2h+) normally, 360 (6h+) for ultra athletes, who get longer options.
 */
export const openEndedMinutes = (ultra: boolean) => (ultra ? 360 : 120);
export const dayCap = (minutes: number, ultra: boolean) => (minutes >= openEndedMinutes(ultra) ? Infinity : minutes);

export const AvailabilityDay = z
  .object({
    minutes: z.number().int().positive().nullable(), // null = rest day
    isDouble: z.boolean().default(false),
    secondMinutes: z.number().int().positive().nullable().default(null),
  })
  .refine((d) => !d.isDouble || (d.minutes !== null && d.secondMinutes !== null), {
    message: "A double day needs a time for both sessions",
  })
  .refine((d) => d.isDouble || d.secondMinutes === null, {
    message: "Only double days have a second session time",
  });
export type AvailabilityDay = z.infer<typeof AvailabilityDay>;

/** Monday to Sunday, in that order. */
export const Availability = z.array(AvailabilityDay).length(7);
export type Availability = z.infer<typeof Availability>;

export function summariseAvailability(week: Availability) {
  const trainingDays = week.filter((d) => d.minutes !== null).length;
  const doubleDays = week.filter((d) => d.isDouble).length;
  return { trainingDays, doubleDays, restDays: 7 - trainingDays };
}

// ---------- Session classification ----------

/** RPE at or above which lower-body work counts as heavy (SPEC decision 4). */
export const HEAVY_LOWER_RPE = 8;

/**
 * Heavy lower-body (SPEC decision 4): a lower-focus session, or a full-body
 * session with a lower-body exercise at RPE 8+. Exercises not in the library
 * are treated as possibly lower-body, to stay on the safe side.
 */
export function isHeavyLowerBody(s: PlannedSession): boolean {
  if (s.type !== "strength") return false;
  if (s.bodyFocus === "lower") return true;
  return s.bodyFocus === "full" && s.exercises.some((e) => e.targetRpe >= HEAVY_LOWER_RPE && mayBeLowerBody(e.name));
}

/** True for lower-body library exercises and for anything not in the library. */
export const mayBeLowerBody = (name: string) => findExercise(name)?.isLowerBody ?? true;

/** Steps at or below this RPE count as easy running (SPEC decision 17). */
export const EASY_MAX_RPE = 4;

/**
 * Easy minutes in a run. With steps, the share of step time at RPE 4 or less
 * is applied to the planned minutes; without steps, the whole run counts by
 * its intensity.
 */
export function easyRunMinutes(s: PlannedSession): number {
  if (s.type !== "run") return 0;
  const stepTotal = s.steps.reduce((sum, st) => sum + st.minutes, 0);
  if (stepTotal === 0) return s.intensity === "easy" ? s.plannedMinutes : 0;
  const easy = s.steps.filter((st) => st.targetRpe <= EASY_MAX_RPE).reduce((sum, st) => sum + st.minutes, 0);
  return (s.plannedMinutes * easy) / stepTotal;
}
