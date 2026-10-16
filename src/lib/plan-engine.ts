// The plan engine's output format, exactly as prompts/plan-engine.md asks the AI
// to return it, and the converter into ede.'s own WeekPlan.
import { z } from "zod";
import { addDays } from "./dates";
import {
  BodyFocus,
  DAY_NAMES,
  Intensity,
  Phase,
  RunKind,
  type PlannedSession,
  type WeekPlan,
} from "./domain";

export const EngineRunStep = z.object({
  name: z.string().min(1),
  duration_minutes: z.number().positive(),
  target_effort_rpe: z.number().min(1).max(10),
});

export const EngineExercise = z.object({
  name: z.string().min(1),
  warmup_sets: z.number().int().min(0),
  working_sets: z.number().int().min(1),
  reps: z.string().min(1),
  target_rpe: z.number().min(1).max(10),
  failure_allowed: z.boolean(),
});

export const EngineSession = z
  .object({
    type: z.enum(["run", "strength"]),
    title: z.string().min(1),
    duration_minutes: z.number().int().positive(),
    intensity: Intensity,
    is_key_session: z.boolean(),
    body_focus: BodyFocus.nullable(),
    steps: z.array(EngineRunStep),
    exercises: z.array(EngineExercise),
    /** Runs only: the plan outline's session kind and level, echoed back. Added for ede.; optional. */
    session_kind: RunKind.optional(),
    level: z.number().int().min(1).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.type === "run") {
      if (s.body_focus !== null)
        ctx.addIssue({ code: "custom", path: ["body_focus"], message: "Runs must have body_focus null" });
      if (s.exercises.length > 0)
        ctx.addIssue({ code: "custom", path: ["exercises"], message: "Runs must have an empty exercises array" });
    } else {
      if (s.body_focus === null)
        ctx.addIssue({ code: "custom", path: ["body_focus"], message: "Strength sessions need a body_focus" });
      if (s.steps.length > 0)
        ctx.addIssue({ code: "custom", path: ["steps"], message: "Strength sessions must have an empty steps array" });
      if (s.session_kind)
        ctx.addIssue({ code: "custom", path: ["session_kind"], message: "Only runs have a session_kind" });
    }
  });
export type EngineSession = z.infer<typeof EngineSession>;

export const EngineDay = z.object({
  day: z.enum(DAY_NAMES),
  sessions: z.array(EngineSession),
  notes: z.string(),
});

/** One week, exactly as the plan engine returns it. */
export const EngineWeek = z
  .object({
    week_number: z.number().int().min(1),
    phase: Phase,
    total_minutes: z.number().min(0),
    run_minutes: z.number().min(0),
    strength_minutes: z.number().min(0),
    days: z.array(EngineDay).length(7),
    coach_note: z.string(),
  })
  .superRefine((w, ctx) => {
    w.days.forEach((d, i) => {
      if (d.day !== DAY_NAMES[i])
        ctx.addIssue({ code: "custom", path: ["days", i, "day"], message: `Day ${i + 1} must be ${DAY_NAMES[i]}, not ${d.day}` });
    });
  });
export type EngineWeek = z.infer<typeof EngineWeek>;

export type EngineParseResult =
  | { ok: true; week: EngineWeek }
  | { ok: false; errors: string[] };

/**
 * Reads the AI's raw reply. It must be JSON only; a surrounding ```json fence
 * is tolerated because models sometimes add one despite the instructions.
 */
export function parseEngineResponse(text: string): EngineParseResult {
  const body = text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, errors: ["The reply was not valid JSON. Return only the JSON object."] };
  }
  const parsed = EngineWeek.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `Invalid plan format at ${i.path.join(".") || "root"}: ${i.message}`,
      ),
    };
  }
  return { ok: true, week: parsed.data };
}

/**
 * Converts the engine's day-by-day week into ede.'s dated sessions.
 * Sessions keep the engine's order within a day: the first is slot 1.
 */
export function toWeekPlan(engine: EngineWeek, weekStart: string): WeekPlan {
  const sessions: PlannedSession[] = [];
  const dayNotes: Record<string, string> = {};

  engine.days.forEach((day, i) => {
    const date = addDays(weekStart, i);
    if (day.notes.trim()) dayNotes[date] = day.notes;
    day.sessions.forEach((s, j) => {
      const base = {
        date,
        slot: (j + 1) as 1 | 2,
        title: s.title,
        intensity: s.intensity,
        plannedMinutes: s.duration_minutes,
        isKeySession: s.is_key_session,
      };
      sessions.push(
        s.type === "run"
          ? {
              ...base,
              type: "run",
              steps: s.steps.map((st) => ({
                name: st.name,
                minutes: st.duration_minutes,
                targetRpe: st.target_effort_rpe,
              })),
              ...(s.session_kind && { kind: s.session_kind }),
              ...(s.level && { level: s.level }),
            }
          : {
              ...base,
              type: "strength",
              bodyFocus: s.body_focus!,
              exercises: s.exercises.map((e) => ({
                name: e.name,
                warmupSets: e.warmup_sets,
                workingSets: e.working_sets,
                reps: e.reps,
                targetRpe: e.target_rpe,
                failureAllowed: e.failure_allowed,
              })),
            },
      );
    });
  });

  return {
    weekStart,
    weekNumber: engine.week_number,
    phase: engine.phase,
    sessions,
    dayNotes,
    coachNote: engine.coach_note,
  };
}

/** ede.'s week in the engine's day-by-day format: the starting point the AI adapts (the reverse of toWeekPlan). */
export function weekToEngine(week: WeekPlan): EngineWeek {
  const minutes = (type: PlannedSession["type"]) => week.sessions.filter((s) => s.type === type).reduce((sum, s) => sum + s.plannedMinutes, 0);
  return {
    week_number: week.weekNumber,
    phase: week.phase,
    total_minutes: minutes("run") + minutes("strength"),
    run_minutes: minutes("run"),
    strength_minutes: minutes("strength"),
    days: DAY_NAMES.map((day, i) => {
      const date = addDays(week.weekStart, i);
      return {
        day,
        notes: week.dayNotes[date] ?? "",
        sessions: week.sessions
          .filter((s) => s.date === date)
          .sort((a, b) => a.slot - b.slot)
          .map((s): EngineSession => ({
            type: s.type,
            title: s.title,
            duration_minutes: s.plannedMinutes,
            intensity: s.intensity,
            is_key_session: s.isKeySession,
            body_focus: s.type === "strength" ? s.bodyFocus : null,
            steps: s.type === "run" ? s.steps.map((st) => ({ name: st.name, duration_minutes: st.minutes, target_effort_rpe: st.targetRpe })) : [],
            exercises:
              s.type === "strength"
                ? s.exercises.map((e) => ({
                    name: e.name,
                    warmup_sets: e.warmupSets,
                    working_sets: e.workingSets,
                    reps: e.reps,
                    target_rpe: e.targetRpe,
                    failure_allowed: e.failureAllowed,
                  }))
                : [],
            ...(s.type === "run" && s.kind && { session_kind: s.kind }),
            ...(s.type === "run" && s.level && { level: s.level }),
          })),
      };
    }),
    coach_note: week.coachNote,
  };
}
