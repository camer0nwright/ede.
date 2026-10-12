import { describe, expect, it } from "vitest";
import { demoAthleteAvailability } from "./demo-athlete";
import {
  cautionFor,
  OnboardingAnswers,
  planStartDate,
  strengthVolumeNote,
  targetDateProblem,
  toOutlineInput,
  warningWords,
} from "./onboarding";
import { buildPlanOutline } from "./plan-outline";

const answers: OnboardingAnswers = {
  goalType: "race",
  raceDistance: "half",
  targetDate: "2027-03-14",
  experienceLevel: "intermediate",
  lastWeekRunMinutes: 150,
  strengthVolume: "low",
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
    expect(input).toMatchObject({ startDate: "2026-10-19", raceDistance: "half", targetDate: "2027-03-14", lastWeekRunMinutes: 150 });
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

describe("strength volume note", () => {
  it("says nothing for Low", () => {
    expect(strengthVolumeNote(answers)).toBeNull();
  });

  it("gently warns about Higher with a lot of running", () => {
    expect(strengthVolumeNote({ ...answers, strengthVolume: "high" })).toMatch(/running recovery/);
  });

  it("steers beginners to Low", () => {
    expect(strengthVolumeNote({ ...answers, strengthVolume: "moderate", experienceLevel: "beginner" })).toMatch(/beginner/);
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
