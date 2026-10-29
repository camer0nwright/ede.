// The onboarding draft: what the setup screens hold while someone answers,
// how unanswered choices fall back to recommendations, and what's missing
// before each screen can be left. Shared by onboarding and the You section.
import { fiveKFromRace } from "@/lib/paces";
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
  healthConsentProblem,
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
  /** Which race the recent time is for (SPEC decision 73); the time is hours (half and marathon), minutes and seconds. */
  recentDistance: "5k" | "10k" | "half" | "marathon";
  recentHours: string;
  /** Unset until chosen; the recommended value is used meanwhile. */
  runsPerWeek?: number;
  liftsPerWeek?: number;
  strengthVolume?: StrengthVolume;
  quick: QuickWeek;
  equipment: (typeof EQUIPMENT_OPTIONS)[number][];
  hasInjury?: boolean;
  injury: Injury & { notes: string };
  injuryHistory: string;
  healthConsent?: boolean;
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
  recentDistance: "5k",
  recentHours: "",
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

/** The recent race time as typed, in seconds. */
export function recentSeconds(d: Draft): number | undefined {
  const seconds = Number(d.recentHours || 0) * 3600 + Number(d.fiveKMin || 0) * 60 + Number(d.fiveKSec || 0);
  return seconds > 0 ? seconds : undefined;
}

/** The 5K time the recent race implies: what paces are worked out from. */
export function fiveKSeconds(d: Draft): number | undefined {
  const seconds = recentSeconds(d);
  return seconds === undefined ? undefined : fiveKFromRace(d.recentDistance ?? "5k", seconds);
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
    ...(d.healthConsent && { healthConsent: true }),
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
        if (five !== undefined && (five < 600 || five > 3600)) return "Check your recent race time";
      }
      return null;
    case "strength":
      return d.equipment.length === 0 ? "Pick the equipment you can use" : null;
    case "you":
      return d.name.trim() ? null : "Tell us what to call you";
    case "injury":
      if (d.hasInjury === undefined) return "Let us know if anything hurts";
      return healthConsentProblem({ injury: d.hasInjury ? d.injury : undefined, injuryHistory: d.injuryHistory, healthConsent: d.healthConsent });
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

/** A saved athlete, as the database holds them (the fields the setup screens use). */
export type SavedAthlete = {
  name: string | null;
  goalType: string;
  goalDetail: string | null;
  targetDate: string | null;
  raceDistance: string | null;
  ultraDistanceKm: number | null;
  elevationGainM: number | null;
  terrain: string | null;
  experienceLevel: string;
  strengthVolume: string;
  lastWeekRunMinutes: number | null;
  longestRecentRunMinutes: number | null;
  targetTimeSeconds: number | null;
  justFinish: boolean;
  runsPerWeek: number | null;
  liftsPerWeek: number | null;
  recent5kMinutes: number | null;
  equipment: string | null;
  injuryHistory: string | null;
  weightUnit: string;
  distanceUnit: string;
  /** Monday to Sunday. */
  availability: Availability;
  injury: (Injury & { notes: string | null }) | null;
  healthConsentAt?: Date | null;
};

/** A saved athlete as a filled-in draft, so the You section can edit one part of it. */
export function athleteToDraft(a: SavedAthlete): Draft {
  const race = a.goalType === "race";
  const short = a.raceDistance === "5k" || a.raceDistance === "10k";
  const t = a.targetTimeSeconds ?? 0;
  const five = a.recent5kMinutes ? Math.round(a.recent5kMinutes * 60) : 0;
  const days = a.availability.flatMap((d, i) => (d.minutes === null ? [] : [i]));
  const minutesOn = (weekend: boolean) =>
    Math.max(0, ...a.availability.filter((d, i) => d.minutes !== null && i >= 5 === weekend).map((d) => d.minutes!));
  return {
    ...START,
    name: a.name ?? "",
    goalType: a.goalType as GoalType,
    ...(a.raceDistance && { raceDistance: a.raceDistance as RaceDistance }),
    ...(a.ultraDistanceKm !== null && { ultraDistanceKm: a.ultraDistanceKm }),
    terrain: (a.terrain as Terrain | null) ?? "road",
    ...(a.elevationGainM !== null && { elevationGainM: a.elevationGainM }),
    targetDate: a.targetDate ?? "",
    timeBig: race && t ? String(short ? Math.floor(t / 60) : Math.floor(t / 3600)) : "",
    timeSmall: race && t ? String(short ? t % 60 : Math.floor((t % 3600) / 60)).padStart(2, "0") : "",
    justFinish: race && a.justFinish,
    goalDetail: a.goalDetail ?? "",
    experienceLevel: a.experienceLevel as ExperienceLevel,
    lastWeekRunMinutes: a.lastWeekRunMinutes ?? 0,
    longestRecentRunMinutes: a.longestRecentRunMinutes ?? 0,
    fiveKMin: five ? String(Math.floor(five / 60)) : "",
    fiveKSec: five ? String(five % 60).padStart(2, "0") : "",
    ...(a.runsPerWeek !== null && { runsPerWeek: a.runsPerWeek }),
    ...(a.liftsPerWeek !== null && { liftsPerWeek: a.liftsPerWeek }),
    strengthVolume: a.strengthVolume as StrengthVolume,
    quick: { days, weekdayMinutes: minutesOn(false) || START_WEEK.weekdayMinutes, weekendMinutes: minutesOn(true) || START_WEEK.weekendMinutes },
    equipment: (a.equipment ?? "Full gym").split(", ").filter((e): e is Draft["equipment"][number] => (EQUIPMENT_OPTIONS as readonly string[]).includes(e)),
    hasInjury: a.injury !== null,
    injury: a.injury ? { ...a.injury, notes: a.injury.notes ?? "" } : START.injury,
    injuryHistory: a.injuryHistory ?? "",
    healthConsent: !!a.healthConsentAt,
    availability: a.availability,
    weightUnit: a.weightUnit === "lb" ? "lb" : "kg",
    distanceUnit: a.distanceUnit === "mi" ? "mi" : "km",
  };
}

/** The parts of the plan the You section edits one at a time, and the setup screen each uses. */
export const SECTIONS = {
  goal: { title: "Goal", step: "goal" },
  training: { title: "Training", step: "experience" },
  lifting: { title: "Lifting", step: "strength" },
  week: { title: "Your week", step: "week" },
} as const satisfies Record<string, { title: string; step: Step }>;
export type SectionId = keyof typeof SECTIONS;
export const isSection = (s: string): s is SectionId => s in SECTIONS;

/** What's missing before a section can be saved. Changing session counts must still fit the week. */
export function sectionProblem(section: SectionId, d: Draft): string | null {
  const problem = stepProblem(SECTIONS[section].step, d);
  if (problem) return problem;
  if (section !== "week" && stepProblem("week", d)) return "Your week doesn't have room for that many sessions. Change Your week first, or pick fewer.";
  return null;
}
