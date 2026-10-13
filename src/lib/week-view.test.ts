import { describe, expect, it } from "vitest";
import { demoAthleteAvailability, demoOutline, demoOutlineInput } from "./demo-athlete";
import { RUN_KINDS } from "./domain";
import { RUN_PURPOSE, RUN_TIP } from "./session-library";
import { equipmentFromAnswers } from "./strength-builder";
import { buildPlanWeeks } from "./week-builder";
import { effortOf, weekDays } from "./week-view";

const built = buildPlanWeeks(demoOutline, {
  availability: demoAthleteAvailability,
  ultra: false,
  strengthVolume: demoOutlineInput.strengthVolume,
  experienceLevel: demoOutlineInput.experienceLevel,
  equipment: equipmentFromAnswers(["Full gym"]),
});

describe("week view", () => {
  const days = weekDays(built[4].week);

  it("shows every day Monday to Sunday, rest days included", () => {
    expect(days.map((d) => d.dayName)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    expect(days.flatMap((d) => d.sessions)).toHaveLength(built[4].week.sessions.length);
  });

  it("gives every run a purpose, a tip and coloured steps", () => {
    for (const s of days.flatMap((d) => d.sessions)) {
      if (s.type !== "run") continue;
      expect(s.purpose.length).toBeGreaterThan(10);
      expect(s.tip.length).toBeGreaterThan(10);
      expect(s.steps.reduce((sum, st) => sum + st.minutes, 0)).toBe(s.minutes);
    }
  });

  it("lists each gym session's exercises with sets, reps, effort and rest", () => {
    const lift = days.flatMap((d) => d.sessions).find((s) => s.type === "strength");
    expect(lift && lift.type === "strength" && lift.exercises[0]).toMatchObject({ workingSets: expect.any(Number), reps: expect.any(String), restSeconds: expect.any(Number) });
  });

  it("has a purpose and a tip for every kind of run", () => {
    for (const k of RUN_KINDS) {
      expect(RUN_PURPOSE[k]).toBeTruthy();
      expect(RUN_TIP[k]).toBeTruthy();
    }
  });

  it("adds pace guides to run steps when there's a recent 5K", () => {
    const withPaces = weekDays(built[4].week, { fiveKSeconds: 1500, unit: "km" });
    const steps = withPaces.flatMap((d) => d.sessions).flatMap((s) => (s.type === "run" ? s.steps : []));
    expect(steps.length).toBeGreaterThan(0);
    for (const st of steps) expect(st.pace).toMatch(/^\d+:\d\d-\d+:\d\d\/km$/);
    expect(days.flatMap((d) => d.sessions).flatMap((s) => (s.type === "run" ? s.steps : [])).every((st) => st.pace === undefined)).toBe(true);
  });

  it("colours effort: RPE 4 or less easy, 5-6 moderate, 7+ hard", () => {
    expect([3, 4, 5, 6, 7, 9].map(effortOf)).toEqual(["easy", "easy", "moderate", "moderate", "hard", "hard"]);
  });
});
