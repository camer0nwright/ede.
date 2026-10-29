import { describe, expect, it } from "vitest";
import { build } from "@/test/injured-plan";
import { PROFILES } from "@/test/profiles";
import type { StrengthExercise, WeekPlan } from "./domain";
import { buildPlanOutline } from "./plan-outline";
import { equipmentFromAnswers } from "./strength-builder";
import { applySwaps, applySwapsToWeeks, swapTarget } from "./swaps";
import { buildPlanWeeks } from "./week-builder";

// Remembered swaps (SPEC decision 77).

const gym = { equipment: equipmentFromAnswers(["Full gym"]) };
const ex = (name: string, failureAllowed = true): StrengthExercise => ({ name, warmupSets: 0, workingSets: 2, reps: "8-10", targetRpe: failureAllowed ? 10 : 9, failureAllowed });

describe("which exercise a kept swap gives", () => {
  it("is the athlete's choice", () => {
    expect(swapTarget("Pull-up", { "Pull-up": "Lat pulldown" }, gym)?.name).toBe("Lat pulldown");
    expect(swapTarget("Bench press", { "Pull-up": "Lat pulldown" }, gym)).toBeUndefined();
  });

  it("follows a swap of a swap", () => {
    expect(swapTarget("Pull-up", { "Pull-up": "Lat pulldown", "Lat pulldown": "Assisted pull-up" }, gym)?.name).toBe("Assisted pull-up");
  });

  it("doesn't loop when swaps point back at each other", () => {
    expect(swapTarget("Pull-up", { "Pull-up": "Lat pulldown", "Lat pulldown": "Pull-up" }, gym)?.name).toBe("Lat pulldown");
  });

  it("is skipped when it no longer suits the equipment or an injury", () => {
    expect(swapTarget("Pull-up", { "Pull-up": "Lat pulldown" }, { equipment: equipmentFromAnswers(["Dumbbells"]) })).toBeUndefined();
    expect(swapTarget("Leg press", { "Leg press": "Goblet squat" }, { ...gym, avoid: "knee" })).toBeUndefined();
  });

  it("falls back to an earlier choice in the chain that still fits", () => {
    const dumbbells = { equipment: equipmentFromAnswers(["Dumbbells"]) };
    expect(swapTarget("Back squat", { "Back squat": "Goblet squat", "Goblet squat": "Leg press" }, dumbbells)?.name).toBe("Goblet squat");
  });
});

describe("applying kept swaps to a session", () => {
  it("replaces the exercise and keeps its sets, reps and effort", () => {
    const [swapped] = applySwaps([ex("Pull-up")], { "Pull-up": "Lat pulldown" }, gym);
    expect(swapped).toEqual({ ...ex("Pull-up"), name: "Lat pulldown" });
  });

  it("never goes to failure on a heavy barbell lift swapped in", () => {
    const [swapped] = applySwaps([ex("Leg press")], { "Leg press": "Back squat" }, gym);
    expect(swapped).toMatchObject({ name: "Back squat", failureAllowed: false });
  });

  it("never puts the same exercise in twice", () => {
    const out = applySwaps([ex("Pull-up"), ex("Lat pulldown")], { "Pull-up": "Lat pulldown" }, gym);
    expect(out.map((e) => e.name)).toEqual(["Pull-up", "Lat pulldown"]);
  });
});

describe("applying kept swaps to the plan", () => {
  const input = PROFILES["half marathon, intermediate"];
  const weeks = buildPlanWeeks(buildPlanOutline(input), build(input)).map((b) => b.week).slice(0, 3);
  const names = (w: WeekPlan[]) => w.flatMap((wk) => wk.sessions.flatMap((s) => (s.type === "strength" ? s.exercises.map((e) => `${s.date}:${e.name}`) : [])));
  const plannedSquats = names(weeks).filter((n) => n.endsWith(":Back squat"));
  const today = weeks[1].weekStart;

  it("changes only sessions from today on that haven't been started or checked in", () => {
    expect(plannedSquats.length).toBeGreaterThan(1);
    const started = plannedSquats.find((n) => n >= today)!.split(":")[0];
    const out = names(applySwapsToWeeks(weeks, { "Back squat": "Leg press" }, { ...gym, from: today, started: (date) => date === started }));
    for (const n of plannedSquats) {
      const date = n.split(":")[0];
      const kept = date < today || date === started;
      expect(out.includes(n), n).toBe(kept);
      expect(out.includes(`${date}:Leg press`), n).toBe(!kept);
    }
  });

  it("leaves the plan alone with no kept swaps", () => {
    expect(applySwapsToWeeks(weeks, {}, { ...gym, from: today, started: () => false })).toBe(weeks);
  });
});
