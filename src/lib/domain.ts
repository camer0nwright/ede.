// Shared shapes for ede.'s training data. The database stores enums as strings,
// so everything that comes in (AI output, form input, rows) is validated here.
import { z } from "zod";

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

/** A calendar date as YYYY-MM-DD, with no time zone. */
export const IsoDate = z.iso.date();

// ---------- Session steps ----------

export const RunStep = z.object({
  kind: z.enum(["warmup", "steady", "interval", "recovery", "cooldown"]),
  description: z.string().min(1),
  minutes: z.number().positive().optional(),
  distanceKm: z.number().positive().optional(),
  repeat: z.number().int().min(1).optional(),
});
export type RunStep = z.infer<typeof RunStep>;

export const StrengthExercise = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1),
  reps: z.string().min(1), // "5", "8-10", "30s"
  load: z.string().optional(), // "RPE 7", "60 kg"
  isLegs: z.boolean().default(false),
  notes: z.string().optional(),
});
export type StrengthExercise = z.infer<typeof StrengthExercise>;

// ---------- Planned sessions ----------

const sessionBase = {
  date: IsoDate,
  slot: z.union([z.literal(1), z.literal(2)]).default(1),
  title: z.string().min(1),
  intensity: Intensity,
  plannedMinutes: z.number().int().positive(),
};

export const RunSession = z.object({
  ...sessionBase,
  type: z.literal("run"),
  isKeyRun: z.boolean().default(false),
  steps: z.array(RunStep).default([]),
});

export const StrengthSession = z.object({
  ...sessionBase,
  type: z.literal("strength"),
  isHeavyLegs: z.boolean().default(false),
  steps: z.array(StrengthExercise).default([]),
});

/** One planned session, in the format the AI must return. */
export const PlannedSession = z.discriminatedUnion("type", [
  RunSession,
  StrengthSession,
]);
export type PlannedSession = z.infer<typeof PlannedSession>;

/** A week of sessions. Days with no sessions are rest days. */
export const WeekPlan = z.object({
  weekStart: IsoDate, // a Monday
  isRecoveryWeek: z.boolean().default(false),
  isTaperWeek: z.boolean().default(false),
  sessions: z.array(PlannedSession),
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
