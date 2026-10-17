import { describe, expect, it } from "vitest";
import { demoAthleteAvailability } from "./demo-athlete";
import {
  cautionFor,
  desiredTimeNote,
  HEALTH_CONSENT_NEEDED,
  healthConsentProblem,
  OnboardingAnswers,
  planStartDate,
  quickWeekToAvailability,
  recommendedVolume,
  strengthVolumeNote,
  targetDateProblem,
  toOutlineInput,
  warningWords,
  weekFitProblem,
} from "./onboarding";
import { buildPlanOutline } from "./plan-outline";

const answers: OnboardingAnswers = {
  name: "Sam",
  longestRecentRunMinutes: 75,
  goalType: "race",
  raceDistance: "half",
  targetDate: "2027-03-14",
  targetTimeSeconds: 6600,
  experienceLevel: "intermediate",
  lastWeekRunMinutes: 150,
  runsPerWeek: 4,
  liftsPerWeek: 2,
  strengthVolume: "moderate",
  equipment: ["Full gym"],
  availability: demoAthleteAvailability,
  weightUnit: "kg",
  distanceUnit: "km",
};

const issues = (a: unknown) => {
  const r = OnboardingAnswers.safeParse(a);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("onboarding answers", () => {
  it("accepts a complete set of answers", () => {
    expect(issues(answers)).toEqual([]);
  });

  it("needs a race distance for a race, and a distance for an ultra", () => {
    expect(issues({ ...answers, raceDistance: undefined })).toContain("Pick a race distance");
    expect(issues({ ...answers, raceDistance: "ultra" })).toContain("Enter the ultra's distance");
  });

  it("needs 2 to 6 training days", () => {
    const rest = { minutes: null, isDouble: false, secondMinutes: null };
    const train = { minutes: 45, isDouble: false, secondMinutes: null };
    expect(issues({ ...answers, availability: [train, rest, rest, rest, rest, rest, rest] })).toContain("Choose at least 2 training days");
    expect(issues({ ...answers, availability: Array(7).fill(train) })).toContain("Keep at least 1 full rest day");
  });

  it("needs a race date and a desired time (or just finish) for a race", () => {
    expect(issues({ ...answers, targetDate: undefined })).toContain("Enter your race date");
    expect(issues({ ...answers, targetTimeSeconds: undefined })).toContain("Enter a desired time, or choose just finish");
    expect(issues({ ...answers, targetTimeSeconds: undefined, justFinish: true })).toEqual([]);
    expect(issues({ ...answers, goalType: "general", targetDate: undefined, targetTimeSeconds: undefined })).toEqual([]);
  });

  it("needs the chosen runs and lifts to fit the week", () => {
    expect(issues({ ...answers, runsPerWeek: 6 })).toEqual([expect.stringMatching(/6 runs need 6 training days/)]);
  });

  it("needs a name to call you by", () => {
    expect(issues({ ...answers, name: "  " })).toContain("Tell us what to call you");
  });

  it("passes just finish and the longest recent run to the plan", () => {
    const input = toOutlineInput({ ...answers, targetTimeSeconds: undefined, justFinish: true }, "2026-10-14");
    expect([input.justFinish, input.longestRecentRunMinutes]).toEqual([true, 75]);
  });

  it("needs at least one kind of equipment", () => {
    expect(issues({ ...answers, equipment: [] })).toContain("Pick at least one");
  });
});

describe("plan start and target date", () => {
  it("starts the plan on the next Monday, or today if it's a Monday", () => {
    expect(planStartDate("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(planStartDate("2026-10-14")).toBe("2026-10-19"); // Wednesday
    expect(planStartDate("2026-10-18")).toBe("2026-10-19"); // Sunday
  });

  it("flags a target date in the past or before the plan starts", () => {
    expect(targetDateProblem("2026-10-01", "2026-10-14")).toMatch(/already passed/);
    expect(targetDateProblem("2026-10-16", "2026-10-14")).toMatch(/before your plan would start/);
    expect(targetDateProblem("2027-03-14", "2026-10-14")).toBeNull();
  });
});

describe("toOutlineInput", () => {
  it("builds a plan outline from the answers", () => {
    const input = toOutlineInput(answers, "2026-10-14");
    expect(input).toMatchObject({ startDate: "2026-10-19", raceDistance: "half", targetDate: "2027-03-14", lastWeekRunMinutes: 150, runsPerWeek: 4, liftsPerWeek: 2 });
    expect(buildPlanOutline(input).weeks.at(-1)!.phase).toBe("taper");
  });

  it("drops race details for non-race goals", () => {
    const input = toOutlineInput({ ...answers, goalType: "general" }, "2026-10-14");
    expect(input.raceDistance).toBeUndefined();
    expect(input.targetDate).toBeUndefined();
    expect(buildPlanOutline(input).weeks).toHaveLength(8);
  });

  it("passes ultra distance and terrain through, defaulting to road", () => {
    const input = toOutlineInput({ ...answers, raceDistance: "ultra", ultraDistanceKm: 100 }, "2026-10-14");
    expect([input.ultraDistanceKm, input.terrain]).toEqual([100, "road"]);
  });
});

describe("lifting recommendation", () => {
  it("recommends Moderate, or Low for beginners, ultras and 5+ runs a week", () => {
    expect(recommendedVolume({ experienceLevel: "intermediate", raceDistance: "half", runsPerWeek: 4 })).toBe("moderate");
    expect(recommendedVolume({ experienceLevel: "beginner" })).toBe("low");
    expect(recommendedVolume({ experienceLevel: "advanced", raceDistance: "ultra" })).toBe("low");
    expect(recommendedVolume({ experienceLevel: "advanced", runsPerWeek: 5 })).toBe("low");
  });

  it("says nothing when the choice matches the recommendation", () => {
    expect(strengthVolumeNote(answers)).toBeNull();
  });

  it("gently warns about Higher with a lot of running", () => {
    expect(strengthVolumeNote({ ...answers, strengthVolume: "high" })).toMatch(/running recovery/);
  });

  it("steers beginners to Low", () => {
    expect(strengthVolumeNote({ ...answers, experienceLevel: "beginner" })).toMatch(/beginner/);
  });

  it("notes Low for an ultra choosing Moderate", () => {
    expect(strengthVolumeNote({ ...answers, raceDistance: "ultra", runsPerWeek: 3 })).toMatch(/Low keeps your legs fresher/);
  });
});

describe("week fit", () => {
  const rest = { minutes: null, isDouble: false, secondMinutes: null };
  const train = { minutes: 45, isDouble: false, secondMinutes: null };
  const double = { minutes: 45, isDouble: true, secondMinutes: 45 };

  it("fits runs and lifts on separate days, or a run and a lift on a double day", () => {
    expect(weekFitProblem([train, train, train, rest, train, train, rest], 3, 2)).toBeNull();
    expect(weekFitProblem([double, train, double, rest, train, rest, rest], 3, 2)).toBeNull();
  });

  it("says what to add when the week is too small", () => {
    expect(weekFitProblem([train, train, train, rest, rest, rest, rest], 3, 2)).toMatch(/need 5 slots, but your week has 3. Add 2 more/);
    expect(weekFitProblem([train, train, train, train, rest, rest, rest], 3, 2)).toMatch(/Add a training day or a double day/);
  });
});

describe("desired time", () => {
  it("notes an ambitious time for the experience level", () => {
    expect(desiredTimeNote("half", 85 * 60, "intermediate")).toMatch(/ambitious/);
    expect(desiredTimeNote("half", 110 * 60, "intermediate")).toBeNull();
    expect(desiredTimeNote("ultra", 600, "beginner")).toBeNull();
  });
});

describe("quick week setup", () => {
  it("fills chosen days with weekday or weekend time and keeps double days", () => {
    const before = quickWeekToAvailability({ days: [1, 3, 5], weekdayMinutes: 45, weekendMinutes: 120 });
    expect(before.map((d) => d.minutes)).toEqual([null, 45, null, 45, null, 120, null]);
    before[1] = { minutes: 45, isDouble: true, secondMinutes: 30 };
    const after = quickWeekToAvailability({ days: [1, 3, 5, 6], weekdayMinutes: 60, weekendMinutes: 90 }, before);
    expect(after.map((d) => d.minutes)).toEqual([null, 60, null, 60, null, 90, 90]);
    expect(after[1]).toEqual({ minutes: 60, isDouble: true, secondMinutes: 30 });
  });
});

describe("warning words and caution", () => {
  it("finds warning words in notes", () => {
    expect(warningWords("Some chest tightness and I felt dizzy")).toEqual(["dizzy", "chest"]);
    expect(warningWords("All good")).toEqual([]);
  });

  it("sends chest pain or dizziness to a doctor", () => {
    expect(cautionFor({ injuryHistory: "I got dizzy on my last long run" })).toMatch(/doctor/);
  });

  it("matches advice to pain level", () => {
    const injury = (painLevel: number, painWhen: "running" | "resting" = "running") => ({ injury: { area: "knee" as const, painLevel, painWhen } });
    expect(cautionFor(injury(2))).toBeNull();
    expect(cautionFor(injury(5))).toMatch(/physio/);
    expect(cautionFor(injury(8))).toMatch(/see a doctor/);
    expect(cautionFor(injury(2, "resting"))).toMatch(/see a doctor/);
  });
});

describe("health data consent", () => {
  const injury = { area: "ankle" as const, painLevel: 3, painWhen: "running" as const };

  it("needs agreement before keeping a current injury", () => {
    expect(healthConsentProblem({ injury })).toBe(HEALTH_CONSENT_NEEDED);
    expect(healthConsentProblem({ injury, healthConsent: true })).toBeNull();
  });

  it("needs agreement before keeping past injuries", () => {
    expect(healthConsentProblem({ injuryHistory: "Achilles in 2025" })).toBe(HEALTH_CONSENT_NEEDED);
    expect(healthConsentProblem({ injuryHistory: "Achilles in 2025", healthConsent: true })).toBeNull();
  });

  it("asks nothing when there are no injury details", () => {
    expect(healthConsentProblem({})).toBeNull();
    expect(healthConsentProblem({ injuryHistory: "   " })).toBeNull();
  });
});
