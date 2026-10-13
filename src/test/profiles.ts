// Test athletes shared by the plan outline and week builder tests.
import { Availability, type AvailabilityDay } from "@/lib/domain";
import type { OutlineInput } from "@/lib/plan-outline";

const day = (minutes: number | null, second?: number): AvailabilityDay =>
  second ? { minutes, isDouble: true, secondMinutes: second } : { minutes, isDouble: false, secondMinutes: null };

const typical = Availability.parse([day(60), day(45, 45), day(60), day(45), day(null), day(120), day(90)]);
const tight = Availability.parse([day(null), day(45), day(null), day(45), day(null), day(60), day(null)]);
const ultraWeek = Availability.parse([day(60), day(60, 45), day(75), day(60), day(null), day(360), day(240)]);
// Short weekdays and a big weekend: the shape that exposed stalls and lost sessions.
const shortWeekdays = Availability.parse([day(null), day(45, 45), day(45), day(60), day(null), day(300), day(180)]);

export const base: OutlineInput = {
  startDate: "2026-10-12",
  goalType: "general",
  experienceLevel: "intermediate",
  strengthVolume: "low",
  availability: typical,
};

export const PROFILES: Record<string, OutlineInput> = {
  "half marathon, intermediate": { ...base, goalType: "race", raceDistance: "half", targetDate: "2027-01-31", lastWeekRunMinutes: 150 },
  "beginner 5K": { ...base, goalType: "race", raceDistance: "5k", targetDate: "2026-12-20", experienceLevel: "beginner" },
  "marathon, advanced": { ...base, goalType: "race", raceDistance: "marathon", targetDate: "2027-03-07", experienceLevel: "advanced", lastWeekRunMinutes: 240 },
  "10K on tight availability": { ...base, goalType: "race", raceDistance: "10k", targetDate: "2026-12-13", availability: tight, lastWeekRunMinutes: 90 },
  "100-mile mountain ultra": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 161, terrain: "mountain", targetDate: "2027-04-04", experienceLevel: "advanced", availability: ultraWeek, lastWeekRunMinutes: 360 },
  "100K trail ultra, short weekdays": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 100, terrain: "trail", targetDate: "2027-05-16", experienceLevel: "advanced", availability: shortWeekdays, lastWeekRunMinutes: 300 },
  "50K road ultra": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 50, terrain: "road", targetDate: "2027-02-14", availability: ultraWeek, lastWeekRunMinutes: 240 },
  "general fitness, no date": { ...base, lastWeekRunMinutes: 100 },
  "half marathon, chosen 4 runs and 3 lifts": { ...base, goalType: "race", raceDistance: "half", targetDate: "2027-02-28", lastWeekRunMinutes: 150, runsPerWeek: 4, liftsPerWeek: 3, availability: Availability.parse([day(null), day(60, 45), day(45, 45), day(60), day(45), day(120), day(null)]) },
  "ultra, chosen 5 runs and 2 lifts": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 80.5, terrain: "trail", targetDate: "2027-04-18", experienceLevel: "advanced", lastWeekRunMinutes: 300, runsPerWeek: 5, liftsPerWeek: 2, availability: ultraWeek },
  "half marathon, 3 runs on 45-minute weekdays": { ...base, goalType: "race", raceDistance: "half", targetDate: "2027-08-20", experienceLevel: "advanced", lastWeekRunMinutes: 300, runsPerWeek: 3, liftsPerWeek: 3, strengthVolume: "moderate", availability: Availability.parse([day(null), day(45, 45), day(45), day(45), day(null), day(90), day(90)]) },
  "beginner, chosen 4 runs from almost nothing": { ...base, goalType: "race", raceDistance: "5k", targetDate: "2027-01-10", experienceLevel: "beginner", lastWeekRunMinutes: 0, runsPerWeek: 4, liftsPerWeek: 2 },
  "strength goal, moderate volume": { ...base, goalType: "strength", strengthVolume: "moderate", lastWeekRunMinutes: 80 },
};

