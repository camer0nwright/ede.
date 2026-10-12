// The demo athlete's availability and first week. Used by the seed script and
// as the known-good plan in the plan checker tests.
import { Availability, WeekPlan } from "./domain";

// Monday to Sunday. Tuesday, Wednesday and Sunday are double days
// (an easy run plus a lift); Monday and Friday are full rest days.
export const demoAvailability = Availability.parse([
  { minutes: null },
  { minutes: 30, isDouble: true, secondMinutes: 60 },
  { minutes: 45, isDouble: true, secondMinutes: 45 },
  { minutes: 45 },
  { minutes: null },
  { minutes: 90 },
  { minutes: 30, isDouble: true, secondMinutes: 60 },
]);

const easyRun = (date: string, minutes: number, title = "Easy run") => ({
  date,
  slot: 1,
  type: "run",
  title,
  intensity: "easy",
  plannedMinutes: minutes,
  steps: [{ kind: "steady", minutes, description: "Conversational pace" }],
});

// Most running is easy: 4 easy runs and 1 hard session (about 80% easy by time).
export const demoWeek = WeekPlan.parse({
  weekStart: "2026-10-12",
  sessions: [
    easyRun("2026-10-13", 30),
    {
      date: "2026-10-13",
      slot: 2,
      type: "strength",
      title: "Lower body strength",
      intensity: "hard",
      plannedMinutes: 60,
      isHeavyLegs: true,
      steps: [
        { name: "Back squat", sets: 4, reps: "5", load: "RPE 8", isLegs: true },
        { name: "Romanian deadlift", sets: 3, reps: "8", load: "RPE 7", isLegs: true },
        { name: "Plank", sets: 3, reps: "45s" },
      ],
    },
    easyRun("2026-10-14", 40),
    {
      date: "2026-10-14",
      slot: 2,
      type: "strength",
      title: "Upper body strength",
      intensity: "moderate",
      plannedMinutes: 45,
      steps: [
        { name: "Bench press", sets: 4, reps: "6", load: "RPE 7" },
        { name: "Pull-ups", sets: 4, reps: "6-8" },
      ],
    },
    {
      date: "2026-10-15",
      type: "run",
      title: "Intervals",
      intensity: "hard",
      plannedMinutes: 45,
      isKeyRun: true,
      steps: [
        { kind: "warmup", minutes: 12, description: "Easy jog plus 4 strides" },
        { kind: "interval", minutes: 4, repeat: 4, description: "Hard, about 10k pace" },
        { kind: "recovery", minutes: 2, repeat: 4, description: "Walk or very easy jog" },
        { kind: "cooldown", minutes: 9, description: "Easy jog" },
      ],
    },
    {
      date: "2026-10-17",
      type: "run",
      title: "Long easy run",
      intensity: "easy",
      plannedMinutes: 85,
      isKeyRun: true,
      steps: [{ kind: "steady", minutes: 85, description: "Easy, conversational pace throughout" }],
    },
    easyRun("2026-10-18", 30, "Recovery run"),
    {
      date: "2026-10-18",
      slot: 2,
      type: "strength",
      title: "Full body, light legs",
      intensity: "moderate",
      plannedMinutes: 50,
      steps: [
        { name: "Overhead press", sets: 3, reps: "8" },
        { name: "Goblet squat", sets: 3, reps: "10", load: "Light", isLegs: true },
      ],
    },
  ],
});
