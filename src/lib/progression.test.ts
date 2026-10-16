import { describe, expect, it } from "vitest";
import type { StrengthExercise } from "./domain";
import { addOptions, holdReason, plannedFromLibrary, repRange, suggestNext, swapOptions, weightStep } from "./progression";
import { findExercise } from "./exercise-library";
import type { LoggedSet } from "./workout";

const bench: StrengthExercise = { name: "Bench press", warmupSets: 2, workingSets: 3, reps: "6-8", targetRpe: 8.5, failureAllowed: false };
const sets = (weightKg: number | null, reps: number[], rpe: number | null = null): LoggedSet[] =>
  reps.map((r, i) => ({ exercise: "Bench press", setNumber: i + 3, setType: "working", weightKg, reps: r, rpe }));
const fullGym = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"] as const;

describe("progression", () => {
  it("reads rep ranges, and skips timed holds", () => {
    expect(repRange("6-8")).toEqual([6, 8]);
    expect(repRange("5")).toEqual([5, 5]);
    expect(repRange("30-45s")).toBeNull();
  });

  it("uses plate-sized steps in each unit", () => {
    expect(weightStep(findExercise("Bench press"), "kg")).toBe(2.5);
    expect(weightStep(findExercise("Bench press"), "lb")).toBe(5);
    expect(weightStep(findExercise("Goblet squat"), "kg")).toBe(2);
  });

  it("adds a step when every set hit the top of the range", () => {
    expect(suggestNext(bench, sets(60, [8, 8, 8]), "kg")).toMatchObject({ weight: "62.5", reps: 6, kind: "up" });
    expect(suggestNext(bench, sets(60, [8, 8, 8]), "lb")).toMatchObject({ weight: "137.5", kind: "up" });
  });

  it("keeps the weight and asks for one more rep otherwise", () => {
    expect(suggestNext(bench, sets(60, [8, 7, 6]), "kg")).toMatchObject({ weight: "60", reps: 7, kind: "more-reps" });
  });

  it("doesn't add weight when the top reps felt harder than the target", () => {
    expect(suggestNext(bench, sets(60, [8, 8, 8], 9.5), "kg")).toMatchObject({ weight: "60", kind: "more-reps" });
  });

  it("only adds weight once every planned working set was done", () => {
    expect(suggestNext(bench, sets(60, [8]), "kg")).toMatchObject({ weight: "60", kind: "more-reps", note: "Same weight: last time you logged 1 of 3 sets. Aim for all of them." });
  });

  it("judges the heaviest sets, not lighter back-off sets", () => {
    const mixed = [...sets(60, [8, 8, 8]), ...sets(50, [6])];
    expect(suggestNext(bench, mixed, "kg")?.kind).toBe("up");
  });

  it("holds the weight for a reason, and says nothing without history", () => {
    expect(suggestNext(bench, sets(60, [8, 8, 8]), "kg", "it's a lighter week")).toMatchObject({ weight: "60", kind: "hold", note: "Same as last time: it's a lighter week." });
    expect(suggestNext(bench, [], "kg")).toBeUndefined();
    expect(holdReason({ phase: "recovery", light: false })).toBe("it's a lighter week");
    expect(holdReason({ phase: "build", injuryArea: "shoulder", light: false })).toMatch(/shoulder/);
    expect(holdReason({ phase: "build", light: false })).toBeUndefined();
  });

  it("progresses bodyweight work by reps", () => {
    const pullUp: StrengthExercise = { ...bench, name: "Pull-up", reps: "6-8" };
    expect(suggestNext(pullUp, sets(null, [8, 8, 8]), "kg")).toMatchObject({ reps: 9, kind: "more-reps" });
  });
});

describe("changing exercises", () => {
  it("offers alternatives that suit the equipment and avoid an injury", () => {
    const names = swapOptions("Back squat", [...fullGym]).map((e) => e.name);
    expect(names.slice(0, 3)).toEqual(["Leg press", "Goblet squat", "Hack squat"]);
    expect(swapOptions("Back squat", ["dumbbell", "bodyweight"]).every((e) => ["dumbbell", "bodyweight"].includes(e.equipment))).toBe(true);
    expect(swapOptions("Back squat", [...fullGym], "knee").some((e) => e.loads.includes("knee"))).toBe(false);
  });

  it("searches the library to add an exercise, leaving out what's already there", () => {
    const found = addOptions("curl", [...fullGym], undefined, ["Dumbbell curl"]).map((e) => e.name);
    expect(found.length).toBeGreaterThan(0);
    expect(found).not.toContain("Dumbbell curl");
    expect(found.every((n) => /curl/i.test(n) || findExercise(n)?.muscleGroup.toLowerCase().includes("curl"))).toBe(true);
  });

  it("plans an added exercise with sensible sets and reps", () => {
    expect(plannedFromLibrary(findExercise("Back squat")!)).toMatchObject({ warmupSets: 1, workingSets: 3, reps: "5-8", failureAllowed: false });
    expect(plannedFromLibrary(findExercise("Leg extension")!)).toMatchObject({ warmupSets: 0, reps: "10-12", failureAllowed: true });
  });
});
