// Onboarding answers: the shape the setup screens produce, how they're
// validated, and how they become a plan outline. Shared by the browser (to
// guide the user) and the server (which validates again before saving).
import { z } from "zod";
import { addDays, dayOfWeek } from "./dates";
import {
  Availability,
  ExperienceLevel,
  GoalType,
  Injury,
  IsoDate,
  RaceDistance,
  StrengthVolume,
  Terrain,
} from "./domain";
import type { OutlineInput } from "./plan-outline";

export const EQUIPMENT_OPTIONS = [
  "Full gym",
  "Barbell and plates",
  "Dumbbells",
  "Machines and cables",
  "Resistance bands",
  "Bodyweight only",
] as const;

/** Rough run minutes last week, as offered in onboarding. */
export const LAST_WEEK_RUN_OPTIONS = [
  { label: "None", minutes: 0 },
  { label: "Under 1 hour", minutes: 40 },
  { label: "1-2 hours", minutes: 90 },
  { label: "2-3 hours", minutes: 150 },
  { label: "3-4 hours", minutes: 210 },
  { label: "4-6 hours", minutes: 300 },
  { label: "6+ hours", minutes: 420 },
] as const;

export const ULTRA_PRESETS = [
  { label: "50K", km: 50 },
  { label: "50 miles", km: 80.5 },
  { label: "100K", km: 100 },
  { label: "100 miles", km: 161 },
] as const;

/** Time options in the availability grid. 120 means "120+" except for ultras. */
export const DAY_MINUTES = [30, 45, 60, 90, 120] as const;
export const ULTRA_DAY_MINUTES = [30, 45, 60, 90, 120, 180, 240, 300, 360] as const;

export const OnboardingAnswers = z
  .object({
    name: z.string().trim().max(60).optional(),
    goalType: GoalType,
    raceDistance: RaceDistance.optional(),
    ultraDistanceKm: z.number().min(43).max(500).optional(),
    terrain: Terrain.optional(),
    elevationGainM: z.number().int().min(0).max(20000).optional(),
    targetDate: IsoDate.optional(),
    goalDetail: z.string().trim().max(120).optional(),
    experienceLevel: ExperienceLevel,
    lastWeekRunMinutes: z.number().int().min(0).max(1500),
    currentTraining: z.string().trim().max(500).optional(),
    strengthVolume: StrengthVolume,
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).min(1, "Pick at least one"),
    injury: Injury.extend({ notes: z.string().trim().max(500).optional() }).optional(),
    injuryHistory: z.string().trim().max(500).optional(),
    availability: Availability,
    weightUnit: z.enum(["kg", "lb"]),
    distanceUnit: z.enum(["km", "mi"]),
  })
  .superRefine((a, ctx) => {
    if (a.goalType === "race" && !a.raceDistance) {
      ctx.addIssue({ code: "custom", path: ["raceDistance"], message: "Pick a race distance" });
    }
    if (a.raceDistance === "ultra" && !a.ultraDistanceKm) {
      ctx.addIssue({ code: "custom", path: ["ultraDistanceKm"], message: "Enter the ultra's distance" });
    }
    const days = a.availability.filter((d) => d.minutes !== null).length;
    if (days < 2) ctx.addIssue({ code: "custom", path: ["availability"], message: "Choose at least 2 training days" });
    if (days > 6) ctx.addIssue({ code: "custom", path: ["availability"], message: "Keep at least 1 full rest day" });
  });
export type OnboardingAnswers = z.infer<typeof OnboardingAnswers>;

/** The Monday a new plan starts: today if it's a Monday, otherwise next Monday. */
export function planStartDate(today: string): string {
  const dow = dayOfWeek(today);
  return dow === 0 ? today : addDays(today, 7 - dow);
}

/** Problems with a target date, if any: in the past, or too soon to plan for. */
export function targetDateProblem(targetDate: string, today: string): string | null {
  const start = planStartDate(today);
  if (targetDate < today) return "That date has already passed.";
  if (targetDate < start) return "That's before your plan would start (next Monday).";
  return null;
}

export function toOutlineInput(a: OnboardingAnswers, today: string): OutlineInput {
  const race = a.goalType === "race";
  return {
    startDate: planStartDate(today),
    goalType: a.goalType,
    ...(race && a.raceDistance && { raceDistance: a.raceDistance }),
    ...(race && a.targetDate && { targetDate: a.targetDate }),
    ...(race && a.raceDistance === "ultra" && { ultraDistanceKm: a.ultraDistanceKm, terrain: a.terrain ?? "road" }),
    experienceLevel: a.experienceLevel,
    strengthVolume: a.strengthVolume,
    availability: a.availability,
    lastWeekRunMinutes: a.lastWeekRunMinutes,
  };
}

/**
 * Strength volume advice (SPEC: Strength volume setting). Low is the default
 * for hybrid athletes; Higher with a lot of running gets a gentle note.
 */
export function strengthVolumeNote(a: Pick<OnboardingAnswers, "strengthVolume" | "availability" | "raceDistance" | "experienceLevel">): string | null {
  const runDays = a.availability.filter((d) => d.minutes !== null).length;
  const lotsOfRunning = runDays >= 4 || a.raceDistance === "marathon" || a.raceDistance === "ultra";
  if (a.strengthVolume === "high" && lotsOfRunning) return "This may affect your running recovery. Low or Moderate usually suits a running-focused week.";
  if (a.strengthVolume !== "low" && a.experienceLevel === "beginner") return "As a beginner, Low is the best place to start: you'll learn the lifts without tiring your legs for running.";
  return null;
}

/**
 * Words in free-text notes that call for cautious advice (SPEC: Skip workout
 * behaviour). Returns the words found.
 */
const WARNING_WORDS = ["pain", "painful", "dizzy", "dizziness", "chest", "faint", "fainted", "breathless", "numb", "swelling", "swollen"] as const;
export function warningWords(text: string | undefined): string[] {
  if (!text) return [];
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  return WARNING_WORDS.filter((w) => words.has(w));
}

/** Cautious advice for warning words or severe pain, or null if none is needed. */
export function cautionFor(a: Pick<OnboardingAnswers, "injury" | "injuryHistory">): string | null {
  const words = [...warningWords(a.injury?.notes), ...warningWords(a.injuryHistory)];
  if (words.some((w) => ["chest", "dizzy", "dizziness", "faint", "fainted", "breathless", "numb"].includes(w))) {
    return "Chest pain, dizziness, fainting, numbness or unusual breathlessness need checking by a doctor before you train.";
  }
  if (a.injury && (a.injury.painLevel >= 7 || a.injury.painWhen === "resting")) {
    return "With pain this strong, or pain at rest, please see a doctor before training. ede. will keep your plan to safe upper-body work for now.";
  }
  if (a.injury && (a.injury.painLevel >= 4 || a.injury.painWhen === "walking")) {
    return "ede. will pause running while this settles. A physio or doctor can help you get back sooner.";
  }
  return null;
}
