// The demo athlete's availability and first week, written exactly as the plan
// engine would return it. Used by the seed script and as the known-good plan
// in the plan checker tests.
import { Availability } from "./domain";
import { EngineWeek, toWeekPlan } from "./plan-engine";

// Monday to Sunday. Tuesday and Friday are double days (an easy run, then a
// lift); Monday and Sunday are full rest days.
export const demoAvailability = Availability.parse([
  { minutes: null },
  { minutes: 30, isDouble: true, secondMinutes: 45 },
  { minutes: 45 },
  { minutes: 45 },
  { minutes: 30, isDouble: true, secondMinutes: 45 },
  { minutes: 90 },
  { minutes: null },
]);

const rest = (day: string) => ({ day, sessions: [], notes: "Rest day." });

const easyRun = (minutes: number, title = "Easy run") => ({
  type: "run",
  title,
  duration_minutes: minutes,
  intensity: "easy",
  is_key_session: false,
  body_focus: null,
  steps: [{ name: "Easy running, conversational pace", duration_minutes: minutes, target_effort_rpe: 3 }],
  exercises: [],
});

// Low strength volume (older demo data): 2 working sets per exercise.
// Failure only on machine, cable or isolation exercises.
// Running: 185 of 230 min easy (80%). Strength: 80 min. Total: 310 min.
export const demoEngineWeek = EngineWeek.parse({
  week_number: 1,
  phase: "base",
  total_minutes: 310,
  run_minutes: 230,
  strength_minutes: 80,
  days: [
    rest("Monday"),
    {
      day: "Tuesday",
      sessions: [
        easyRun(30),
        {
          type: "strength",
          title: "Lower body strength",
          duration_minutes: 40,
          intensity: "hard",
          is_key_session: false,
          body_focus: "lower",
          steps: [],
          exercises: [
            { name: "Back squat", warmup_sets: 2, working_sets: 2, reps: "5", target_rpe: 9, failure_allowed: false },
            { name: "Romanian deadlift", warmup_sets: 1, working_sets: 2, reps: "8", target_rpe: 8.5, failure_allowed: false },
            { name: "Seated leg curl (machine)", warmup_sets: 0, working_sets: 2, reps: "10-12", target_rpe: 9.5, failure_allowed: true },
            { name: "Standing calf raise (machine)", warmup_sets: 0, working_sets: 2, reps: "12", target_rpe: 9.5, failure_allowed: true },
          ],
        },
      ],
      notes: "Easy run first, lift later in the day.",
    },
    { day: "Wednesday", sessions: [easyRun(40)], notes: "" },
    {
      day: "Thursday",
      sessions: [
        {
          type: "run",
          title: "Intervals",
          duration_minutes: 45,
          intensity: "hard",
          is_key_session: true,
          body_focus: null,
          steps: [
            { name: "Warm-up: easy jog plus 4 strides", duration_minutes: 12, target_effort_rpe: 3 },
            { name: "4 x 4 min hard (about 10k pace), 2 min easy jog between", duration_minutes: 24, target_effort_rpe: 8 },
            { name: "Cool-down: easy jog", duration_minutes: 9, target_effort_rpe: 3 },
          ],
          exercises: [],
        },
      ],
      notes: "Key session of the week.",
    },
    {
      day: "Friday",
      sessions: [
        easyRun(30, "Recovery run"),
        {
          type: "strength",
          title: "Upper body strength",
          duration_minutes: 40,
          intensity: "hard",
          is_key_session: false,
          body_focus: "upper",
          steps: [],
          exercises: [
            { name: "Bench press", warmup_sets: 2, working_sets: 2, reps: "6", target_rpe: 9, failure_allowed: false },
            { name: "Pull-ups", warmup_sets: 0, working_sets: 2, reps: "6-8", target_rpe: 9, failure_allowed: false },
            { name: "Seated cable row", warmup_sets: 0, working_sets: 2, reps: "10", target_rpe: 9.5, failure_allowed: true },
            { name: "Dumbbell lateral raise", warmup_sets: 0, working_sets: 2, reps: "12-15", target_rpe: 9.5, failure_allowed: true },
          ],
        },
      ],
      notes: "Upper body only after yesterday's intervals, to keep legs fresh for Saturday.",
    },
    {
      day: "Saturday",
      sessions: [
        {
          type: "run",
          title: "Long easy run",
          duration_minutes: 85,
          intensity: "easy",
          is_key_session: true,
          body_focus: null,
          steps: [{ name: "Easy, conversational pace throughout", duration_minutes: 85, target_effort_rpe: 4 }],
          exercises: [],
        },
      ],
      notes: "Longest run of the week.",
    },
    rest("Sunday"),
  ],
  coach_note:
    "A steady base week: mostly easy running with one interval session, and two short, hard lifting sessions kept away from your key runs.",
});

/** The same week as dated sessions, starting Monday 12 October 2026. */
export const demoWeek = toWeekPlan(demoEngineWeek, "2026-10-12");
