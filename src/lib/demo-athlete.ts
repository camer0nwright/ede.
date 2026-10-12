// The demo athlete used by the screens until onboarding and the database are
// connected: an intermediate runner training for a half marathon.
import { Availability } from "./domain";
import { buildPlanOutline, type OutlineInput } from "./plan-outline";

export const DEMO_ATHLETE = {
  name: "Demo athlete",
  goal: "Half marathon under 1:50",
  raceName: "Half marathon",
};

// Monday and Sunday off; Tuesday and Friday are double days; long run on
// Saturday (2h+). The demo week (src/lib/demo-week.ts) fits it too.
export const demoAthleteAvailability = Availability.parse([
  { minutes: null },
  { minutes: 60, isDouble: true, secondMinutes: 45 },
  { minutes: 45 },
  { minutes: 60 },
  { minutes: 60, isDouble: true, secondMinutes: 45 },
  { minutes: 120 },
  { minutes: null },
]);

export const demoOutlineInput: OutlineInput = {
  startDate: "2026-10-12",
  goalType: "race",
  raceDistance: "half",
  targetDate: "2027-03-14",
  experienceLevel: "intermediate",
  strengthVolume: "low",
  availability: demoAthleteAvailability,
  lastWeekRunMinutes: 220,
  runsPerWeek: 4,
  liftsPerWeek: 2,
};

export const demoOutline = buildPlanOutline(demoOutlineInput);

/** A fixed "today" for the demo, so pages can be pre-built. */
export const DEMO_TODAY = "2026-10-14";
