import { describe, expect, it } from "vitest";
import { athleteToDraft, sectionProblem, toAnswers, type SavedAthlete } from "@/components/onboarding/draft";
import { OnboardingAnswers, quickWeekToAvailability } from "./onboarding";
import { mergeSection } from "./plan-settings";

const saved: SavedAthlete = {
  name: "Cam",
  goalType: "race",
  goalDetail: null,
  targetDate: "2027-03-14",
  raceDistance: "half",
  ultraDistanceKm: null,
  elevationGainM: null,
  terrain: null,
  experienceLevel: "intermediate",
  strengthVolume: "moderate",
  lastWeekRunMinutes: 150,
  longestRecentRunMinutes: 75,
  targetTimeSeconds: 6600,
  justFinish: false,
  runsPerWeek: 4,
  liftsPerWeek: 3,
  recent5kMinutes: 24.5,
  equipment: "Full gym, Dumbbells",
  injuryHistory: null,
  weightUnit: "kg",
  distanceUnit: "km",
  availability: quickWeekToAvailability({ days: [0, 1, 2, 3, 5, 6], weekdayMinutes: 60, weekendMinutes: 90 }).map((d, i) =>
    i === 2 ? { ...d, isDouble: true, secondMinutes: 45 } : d,
  ),
  injury: null,
};

describe("editing plan settings", () => {
  it("fills the setup screens from what's saved, so the answers come out the same", () => {
    const draft = athleteToDraft(saved);
    expect([draft.timeBig, draft.timeSmall, draft.fiveKMin, draft.fiveKSec]).toEqual(["1", "50", "24", "30"]);
    expect(draft.quick).toEqual({ days: [0, 1, 2, 3, 5, 6], weekdayMinutes: 60, weekendMinutes: 90 });
    const answers = OnboardingAnswers.parse(toAnswers(draft));
    expect(answers).toMatchObject({ targetTimeSeconds: 6600, recent5kSeconds: 1470, runsPerWeek: 4, liftsPerWeek: 3, equipment: ["Full gym", "Dumbbells"] });
  });

  it("shows 5K and 10K times as minutes and seconds", () => {
    const draft = athleteToDraft({ ...saved, raceDistance: "10k", targetTimeSeconds: 52 * 60 + 5 });
    expect([draft.timeBig, draft.timeSmall]).toEqual(["52", "05"]);
  });

  it("changes only the edited section", () => {
    const answers = toAnswers(athleteToDraft(saved));
    const edited = { ...answers, justFinish: true, targetTimeSeconds: undefined, runsPerWeek: 6, name: "Hacker" };
    const merged = mergeSection(answers, edited, "goal");
    expect(merged).toMatchObject({ justFinish: true, runsPerWeek: 4, name: "Cam" });
    expect(merged).not.toHaveProperty("targetTimeSeconds");
  });

  it("won't save more sessions than the week has room for", () => {
    const draft = { ...athleteToDraft(saved), runsPerWeek: 6, liftsPerWeek: 5 };
    expect(sectionProblem("training", draft)).toMatch(/room/);
    expect(sectionProblem("training", athleteToDraft(saved))).toBeNull();
  });
});
