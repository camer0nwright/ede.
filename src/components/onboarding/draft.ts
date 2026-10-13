// The onboarding draft: what the setup screens hold while someone answers,
// how unanswered choices fall back to recommendations, and what's missing
// before each screen can be left. Shared by onboarding and the You section.
import type {
  Availability,
  ExperienceLevel,
  GoalType,
  Injury,
  PainWhen,
  RaceDistance,
  StrengthVolume,
  Terrain,
} from "@/lib/domain";
import {
  EQUIPMENT_OPTIONS,
  quickWeekToAvailability,
  recommendedVolume,
  targetDateProblem,
  weekFitProblem,
  type QuickWeek,
} from "@/lib/onboarding";
import { recommendedSessions } from "@/lib/plan-outline";

export type Draft = {
  name: string;
  goalType?: GoalType;
  raceDistance?: RaceDistance;
  ultraDistanceKm?: number;
  terrain: Terrain;
  elevationGainM?: number;
  targetDate: string;
  /** Desired time as typed: hours (or minutes for 5K/10K) and the next unit down. */
  timeBig: string;
  timeSmall: string;
  justFinish: boolean;
  goalDetail: string;
  experienceLevel?: ExperienceLevel;
  lastWeekRunMinutes?: number;
  longestRecentRunMinutes?: number;
  /** Optional recent 5K, as typed. */
  fiveKMin: string;
  fiveKSec: string;
  /** Unset until chosen; the recommended value is used meanwhile. */
  runsPerWeek?: number;
  liftsPerWeek?: number;
  strengthVolume?: StrengthVolume;
  quick: QuickWeek;
  equipment: (typeof EQUIPMENT_OPTIONS)[number][];
  hasInjury?: boolean;
  injury: Injury & { notes: string };
  injuryHistory: string;
  availability: Availability;
  weightUnit: "kg" | "lb";
  distanceUnit: "km" | "mi";
};

export const START_WEEK: QuickWeek = { days: [1, 2, 3, 5, 6], weekdayMinutes: 45, weekendMinutes: 90 };

export const START: Draft = {
  name: "",
  terrain: "road",
  targetDate: "",
  timeBig: "",
  timeSmall: "",
  justFinish: false,
  goalDetail: "",
  fiveKMin: "",
  fiveKSec: "",
  equipment: [],
  injury: { area: "knee", painLevel: 2, painWhen: "running", notes: "" },
  injuryHistory: "",
  quick: START_WEEK,
  availability: quickWeekToAvailability(START_WEEK),
  weightUnit: "kg",
  distanceUnit: "km",
};

export const STEPS = ["welcome", "goal", "experience", "strength", "injury", "week", "you", "review"] as const;
export type Step = (typeof STEPS)[number];

export const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "half", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "ultra", label: "Ultra" },
];

export const PAIN_WHEN: { value: PainWhen; label: string }[] = [
  { value: "running", label: "When running" },
  { value: "lifting_only", label: "Only when lifting" },
  { value: "walking", label: "When walking" },
  { value: "resting", label: "At rest or at night" },
];

export const today = () => new Date().toISOString().slice(0, 10);

/** 5K and 10K times are minutes:seconds; longer races are hours:minutes. */
export const shortRace = (d: Draft) => d.raceDistance === "5k" || d.raceDistance === "10k";

export function targetSeconds(d: Draft): number | undefined {
  const big = Number(d.timeBig || 0);
  const small = Number(d.timeSmall || 0);
  const seconds = shortRace(d) ? big * 60 + small : big * 3600 + small * 60;
  return seconds > 0 ? seconds : undefined;
}

export function fiveKSeconds(d: Draft): number | undefined {
  const seconds = Number(d.fiveKMin || 0) * 60 + Number(d.fiveKSec || 0);
  return seconds > 0 ? seconds : undefined;
}

/** Choices the user hasn't made yet fall back to the recommendation. */
export function effective(d: Draft) {
  const rec = recommendedSessions({
    goalType: d.goalType ?? "general",
    raceDistance: d.raceDistance,
    experienceLevel: d.experienceLevel ?? "intermediate",
    strengthVolume: d.strengthVolume ?? "moderate",
    justFinish: d.goalType === "race" && d.justFinish,
  });
  const runs = d.runsPerWeek ?? rec.runs;
  const recVolume = recommendedVolume({ experienceLevel: d.experienceLevel, raceDistance: d.raceDistance, runsPerWeek: runs });
  return { runs, lifts: d.liftsPerWeek ?? rec.lifts, rec, recVolume, volume: d.strengthVolume ?? recVolume };
}

/** The draft as the answers the server expects (validation happens there too). */
export function toAnswers(d: Draft) {
  const race = d.goalType === "race";
  return {
    name: d.name.trim(),
    goalType: d.goalType,
    ...(race && { raceDistance: d.raceDistance }),
    ...(race && d.raceDistance === "ultra" && { ultraDistanceKm: d.ultraDistanceKm, terrain: d.terrain, ...(d.elevationGainM !== undefined && { elevationGainM: d.elevationGainM }) }),
    ...(race && d.targetDate && { targetDate: d.targetDate }),
    ...(race && (d.justFinish ? { justFinish: true } : { targetTimeSeconds: targetSeconds(d) })),
    ...(!race && d.goalDetail.trim() && { goalDetail: d.goalDetail.trim() }),
    experienceLevel: d.experienceLevel,
    lastWeekRunMinutes: d.lastWeekRunMinutes,
    longestRecentRunMinutes: d.longestRecentRunMinutes,
    ...(fiveKSeconds(d) && { recent5kSeconds: fiveKSeconds(d) }),
    runsPerWeek: effective(d).runs,
    liftsPerWeek: effective(d).lifts,
    strengthVolume: effective(d).volume,
    equipment: d.equipment,
    ...(d.hasInjury && { injury: { ...d.injury, notes: d.injury.notes.trim() || undefined } }),
    ...(d.injuryHistory.trim() && { injuryHistory: d.injuryHistory.trim() }),
    availability: d.availability,
    weightUnit: d.weightUnit,
    distanceUnit: d.distanceUnit,
  };
}

/** What's missing before the user can leave a step, or null when it's complete. */
export function stepProblem(step: Step, d: Draft): string | null {
  switch (step) {
    case "goal":
      if (!d.goalType) return "Choose a goal";
      if (d.goalType === "race") {
        if (!d.raceDistance) return "Choose a race distance";
        if (d.raceDistance === "ultra" && !d.ultraDistanceKm) return "Enter the ultra's distance";
        if (!d.targetDate) return "Enter your race date";
        const dateProblem = targetDateProblem(d.targetDate, today());
        if (dateProblem) return dateProblem;
        if (!d.justFinish && !targetSeconds(d)) return "Enter a desired time, or choose just finish";
      }
      return null;
    case "experience":
      if (!d.experienceLevel) return "Choose your experience";
      if (d.lastWeekRunMinutes === undefined) return "Choose roughly how much you ran last week";
      if (d.longestRecentRunMinutes === undefined) return "Choose your longest recent run";
      {
        const five = fiveKSeconds(d);
        if (five !== undefined && (five < 600 || five > 3600)) return "Check your 5K time (minutes and seconds)";
      }
      return null;
    case "strength":
      return d.equipment.length === 0 ? "Pick the equipment you can use" : null;
    case "you":
      return d.name.trim() ? null : "Tell us what to call you";
    case "injury":
      return d.hasInjury === undefined ? "Let us know if anything hurts" : null;
    case "week": {
      const days = d.availability.filter((x) => x.minutes !== null).length;
      if (days < 2) return "Choose at least 2 training days";
      if (days > 6) return "Keep at least 1 full rest day";
      return weekFitProblem(d.availability, effective(d).runs, effective(d).lifts) ? "Make room for your sessions to continue" : null;
    }
    default:
      return null;
  }
}
