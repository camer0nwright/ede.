// Onboarding answers: the shape the setup screens produce, how they're
// validated, and how they become a plan outline. Shared by the browser (to
// guide the user) and the server (which validates again before saving).
import { z } from "zod";
import { addDays, dayOfWeek } from "./dates";
import { plural } from "./format";
import {
  Availability,
  ExperienceLevel,
  GoalType,
  GymSplit,
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

/** Longest run in the last month, as offered in onboarding (minutes). */
export const LONGEST_RUN_OPTIONS = [
  { label: "None", minutes: 0 },
  { label: "Under 20 min", minutes: 15 },
  { label: "20-30 min", minutes: 25 },
  { label: "30-45 min", minutes: 40 },
  { label: "45-60 min", minutes: 55 },
  { label: "1h-1h30", minutes: 75 },
  { label: "1h30-2h", minutes: 105 },
  { label: "2-3 hours", minutes: 150 },
  { label: "3h+", minutes: 200 },
] as const;

export const OnboardingAnswers = z
  .object({
    name: z.string().trim().min(1, "Tell us what to call you").max(60),
    goalType: GoalType,
    raceDistance: RaceDistance.optional(),
    ultraDistanceKm: z.number().min(43).max(500).optional(),
    terrain: Terrain.optional(),
    elevationGainM: z.number().int().min(0).max(20000).optional(),
    targetDate: IsoDate.optional(),
    /** Desired finish time in seconds, or justFinish for "just finish" (races). */
    targetTimeSeconds: z.number().int().positive().max(60 * 60 * 72).optional(),
    justFinish: z.boolean().optional(),
    goalDetail: z.string().trim().max(120).optional(),
    experienceLevel: ExperienceLevel,
    lastWeekRunMinutes: z.number().int().min(0).max(1500),
    longestRecentRunMinutes: z.number().int().min(0).max(1000),
    /** A recent 5K time in seconds, for pace guides (optional). */
    recent5kSeconds: z.number().int().min(600).max(3600).optional(),
    currentTraining: z.string().trim().max(500).optional(),
    runsPerWeek: z.number().int().min(1).max(6),
    liftsPerWeek: z.number().int().min(1).max(5),
    strengthVolume: StrengthVolume,
    /** Unset means ede.'s default for the number of gym days (SPEC decision 75). */
    gymSplit: GymSplit.optional(),
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).min(1, "Pick at least one"),
    injury: Injury.extend({ notes: z.string().trim().max(500).optional() }).optional(),
    injuryHistory: z.string().trim().max(500).optional(),
    /** Agreement to keeping injury details (health data); needed when there are any. */
    healthConsent: z.boolean().optional(),
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
    if (a.goalType === "race" && !a.targetDate) {
      ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Enter your race date" });
    }
    if (a.goalType === "race" && !a.targetTimeSeconds && !a.justFinish) {
      ctx.addIssue({ code: "custom", path: ["targetTimeSeconds"], message: "Enter a desired time, or choose just finish" });
    }
    const days = a.availability.filter((d) => d.minutes !== null).length;
    if (days < 2) ctx.addIssue({ code: "custom", path: ["availability"], message: "Choose at least 2 training days" });
    if (days > 6) ctx.addIssue({ code: "custom", path: ["availability"], message: "Keep at least 1 full rest day" });
    const fit = weekFitProblem(a.availability, a.runsPerWeek, a.liftsPerWeek);
    if (fit) ctx.addIssue({ code: "custom", path: ["availability"], message: fit });
  });
export type OnboardingAnswers = z.infer<typeof OnboardingAnswers>;

export const HEALTH_CONSENT_NEEDED = "Tick the box to let ede. keep your injury details, or leave them out.";

/** Injury details count as health data: they're only kept with agreement (SPEC decision 57). */
export function healthConsentProblem(a: Pick<OnboardingAnswers, "injury" | "injuryHistory" | "healthConsent">): string | null {
  const hasHealthData = !!a.injury || !!a.injuryHistory?.trim();
  return hasHealthData && !a.healthConsent ? HEALTH_CONSENT_NEEDED : null;
}

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
    longestRecentRunMinutes: a.longestRecentRunMinutes,
    ...(race && a.justFinish && { justFinish: true }),
    runsPerWeek: a.runsPerWeek,
    liftsPerWeek: a.liftsPerWeek,
    ...(a.gymSplit && { gymSplit: a.gymSplit }),
  };
}

/**
 * Whether the chosen runs and lifts fit the week: each needs its own day,
 * except on double days, which hold one run and one lift.
 */
export function weekFitProblem(availability: Availability, runs: number, lifts: number): string | null {
  const days = availability.filter((d) => d.minutes !== null).length;
  const doubles = availability.filter((d) => d.minutes !== null && d.isDouble).length;
  if (runs > days) return `${runs} runs need ${runs} training days; you've chosen ${days}. Add a day, or go back and choose fewer runs.`;
  if (lifts > days) return `${lifts} gym sessions need ${lifts} training days; you've chosen ${days}.`;
  const short = runs + lifts - (days + doubles);
  if (short > 0) {
    return `${runs} runs and ${lifts} gym sessions need ${runs + lifts} slots, but your week has ${days + doubles}. Add ${short === 1 ? "a training day or a double day" : `${short} more training or double days`}.`;
  }
  return null;
}

/**
 * Lifting recommendation (SPEC decision 30): Moderate, except Low for
 * beginners, ultras and people running 5+ times a week.
 */
export function recommendedVolume(a: { experienceLevel?: ExperienceLevel; raceDistance?: RaceDistance; runsPerWeek?: number }): StrengthVolume {
  if (a.experienceLevel === "beginner" || a.raceDistance === "ultra" || (a.runsPerWeek ?? 0) >= 5) return "low";
  return "moderate";
}

/** Rough desired times that look ambitious (in minutes) by distance and experience. */
const AMBITIOUS: Record<Exclude<RaceDistance, "ultra">, Record<ExperienceLevel, number>> = {
  "5k": { beginner: 25, intermediate: 19, advanced: 14 },
  "10k": { beginner: 52, intermediate: 40, advanced: 29 },
  half: { beginner: 115, intermediate: 90, advanced: 64 },
  marathon: { beginner: 240, intermediate: 190, advanced: 135 },
};

/** A gentle note when a desired time looks very ambitious, or null. */
export function desiredTimeNote(distance: RaceDistance | undefined, seconds: number | undefined, experience: ExperienceLevel | undefined): string | null {
  if (!distance || distance === "ultra" || !seconds || !experience) return null;
  const minutes = seconds / 60;
  if (minutes < AMBITIOUS[distance][experience]) {
    return "That's an ambitious time for your experience. ede. will build towards it, and the weekly check-ins will show whether to adjust.";
  }
  return null;
}

export type QuickWeek = {
  /** 0 = Monday ... 6 = Sunday. */
  days: number[];
  weekdayMinutes: number;
  weekendMinutes: number;
};

/**
 * Fills the availability grid from the quick questions: chosen days get the
 * weekday or weekend time, the rest are rest days. Double days are kept
 * where a day stays a training day.
 */
export function quickWeekToAvailability(q: QuickWeek, previous?: Availability): Availability {
  return Array.from({ length: 7 }, (_, i) => {
    if (!q.days.includes(i)) return { minutes: null, isDouble: false, secondMinutes: null };
    const before = previous?.[i];
    const keepDouble = before?.isDouble && before.minutes !== null;
    return {
      minutes: i >= 5 ? q.weekendMinutes : q.weekdayMinutes,
      isDouble: keepDouble ?? false,
      secondMinutes: keepDouble ? before!.secondMinutes : null,
    };
  });
}

/**
 * Strength volume advice (SPEC: Strength volume setting): a gentle note when
 * the choice is above what's recommended. Never blocks.
 */
export function strengthVolumeNote(a: {
  strengthVolume: StrengthVolume;
  raceDistance?: RaceDistance;
  experienceLevel?: ExperienceLevel;
  runsPerWeek?: number;
}): string | null {
  const lotsOfRunning = (a.runsPerWeek ?? 0) >= 4 || a.raceDistance === "marathon" || a.raceDistance === "ultra";
  if (a.strengthVolume !== "low" && a.experienceLevel === "beginner") return "As a beginner, Low is the best place to start: you'll learn the lifts without tiring your legs for running.";
  if (a.strengthVolume === "high" && lotsOfRunning) return "This may affect your running recovery. Low or Moderate usually suits a running-focused week.";
  if (a.strengthVolume !== "low" && recommendedVolume(a) === "low") return "With this much running, Low keeps your legs fresher. You can still choose more.";
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

/** The gym splits as setup offers them (SPEC decision 75). */
export const SPLIT_OPTIONS: { value: GymSplit; title: string; description: string }[] = [
  { value: "upper_lower", title: "Upper/Lower", description: "Upper body one day, legs the next." },
  { value: "ppl", title: "Push/Pull/Legs", description: "Chest, shoulders and triceps; back and biceps; then legs." },
  { value: "arnold", title: "Arnold", description: "Chest and back; shoulders and arms; then legs." },
  { value: "full_body", title: "Full body", description: "A bit of everything each session. Best when you're new to lifting." },
];

/** A heads-up when the split has more days than the week has gym sessions, so it rotates. */
export function splitNote(split: GymSplit, lifts: number): string | null {
  const length = { upper_lower: 2, ppl: 3, arnold: 3, full_body: 1 }[split];
  if (lifts % length === 0) return null;
  const name = SPLIT_OPTIONS.find((o) => o.value === split)!.title;
  return `${name} has ${length} different sessions and you have ${plural(lifts, "gym day")}, so it rotates: each week carries on where the last one stopped.`;
}
