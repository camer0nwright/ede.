import { describe, expect, it } from "vitest";
import type { StrengthExercise } from "./domain";
import { buildWorkout, formatWeight, workoutSummary, type LoggedSet, effortWords } from "./workout";

const squat: StrengthExercise = { name: "Back squat", warmupSets: 2, workingSets: 3, reps: "5", targetRpe: 8, failureAllowed: false };
const set = (setNumber: number, weightKg: number, reps: number, setType: LoggedSet["setType"] = "working"): LoggedSet => ({
  exercise: "Back squat",
  setNumber,
  setType,
  weightKg,
  reps,
  rpe: null,
});

describe("gym logging", () => {
  it("shows weights in the athlete's unit, rounded sensibly", () => {
    expect(formatWeight(60, "kg")).toBe("60");
    expect(formatWeight(61.3, "kg")).toBe("61.25");
    expect(formatWeight(60, "lb")).toBe("132.5");
  });

  it("lays out warm-ups then working sets with their targets, starting empty", () => {
    const [block] = buildWorkout([squat], [], {}, "kg");
    expect(block.sets.map((s) => [s.setNumber, s.setType, s.plannedReps ?? ""])).toEqual([
      [1, "warmup", ""],
      [2, "warmup", ""],
      [3, "working", "5"],
      [4, "working", "5"],
      [5, "working", "5"],
    ]);
    expect(block.sets.every((s) => s.weight === "" && !s.done && !s.previous)).toBe(true);
    expect(block.restSeconds).toBeGreaterThanOrEqual(120);
  });

  it("fills in what's been logged, keeps added sets, and matches last time set by set", () => {
    const previous = { "Back squat": [set(1, 40, 5, "warmup"), set(2, 50, 3, "warmup"), set(3, 80, 5), set(4, 80, 5), set(5, 80, 4)] };
    const [block] = buildWorkout([squat], [set(3, 82.5, 5), set(6, 70, 8, "drop")], previous, "kg");
    expect(block.sets[2]).toMatchObject({ weight: "82.5", reps: "5", done: true, previous: { weight: "80", reps: 5 } });
    expect(block.sets[0].previous).toEqual({ weight: "40", reps: 5 });
    expect(block.sets.at(-1)).toMatchObject({ setNumber: 6, setType: "drop", weight: "70", done: true });
  });

  it("sums the working sets and says what beat last time", () => {
    const now = [set(1, 40, 5, "warmup"), set(3, 82.5, 5), set(4, 82.5, 5)];
    const summary = workoutSummary(now, { "Back squat": [set(3, 80, 5)] }, "kg");
    expect(summary).toMatchObject({ sets: 3, workingSets: 2, volume: "825" });
    expect(summary.improvements).toEqual([{ exercise: "Back squat", text: "+2.5 kg" }]);
    expect(workoutSummary([set(3, 80, 7)], { "Back squat": [set(3, 80, 5)] }, "kg").improvements[0].text).toBe("+2 reps at 80 kg");
  });

  it("pre-fills this time's weight and target reps on working sets not yet logged", () => {
    const [block] = buildWorkout([squat], [set(3, 82.5, 5)], {}, "kg", { "Back squat": { weight: "85", reps: 5, note: "Up 2.5 kg" } });
    expect(block.suggestion?.note).toBe("Up 2.5 kg");
    expect(block.sets[0].weight).toBe(""); // warm-up untouched
    expect(block.sets[0].targetReps).toBeUndefined();
    expect(block.sets[2]).toMatchObject({ weight: "82.5", done: true }); // already logged
    expect(block.sets[3]).toMatchObject({ weight: "85", targetReps: 5, done: false });
  });
});

describe("gym effort in plain words (SPEC decision 74)", () => {
  it("says how close to failure a set should go", () => {
    expect(effortWords(10)).toBe("To failure");
    expect(effortWords(9)).toBe("1 rep short of failure");
    expect(effortWords(8)).toBe("2 reps short of failure");
    expect(effortWords(7)).toBe("Comfortable: 3 reps short");
    expect(effortWords(6.5)).toBe("Easy: focus on form");
  });

  it("describes timed holds differently", () => {
    expect(effortWords(9, "30-45s")).toBe("Hard hold");
    expect(effortWords(7, "30-45s")).toBe("Steady hold");
  });
});
