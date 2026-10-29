import { describe, expect, it } from "vitest";
import { demoEngineWeek } from "./demo-week";
import {
  defaultRestSeconds,
  EXERCISES,
  failureAllowed,
  findExercise,
  weightStepKg,
} from "./exercise-library";

describe("exercise library", () => {
  it("has no two exercises sharing a name or alias", () => {
    const names = EXERCISES.flatMap((e) => [e.name, ...(e.aliases ?? [])].map((n) => n.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  });

  it("only lists alternatives that are in the library", () => {
    for (const e of EXERCISES) {
      for (const alt of e.alternatives) expect(findExercise(alt), `${e.name} → ${alt}`).toBeDefined();
    }
  });

  it("finds exercises by name or alias, ignoring case and notes in brackets", () => {
    expect(findExercise("back squat")?.name).toBe("Back squat");
    expect(findExercise("RDL")?.name).toBe("Romanian deadlift");
    expect(findExercise("Seated leg curl (machine)")?.name).toBe("Seated leg curl");
    expect(findExercise("Pull-ups")?.name).toBe("Pull-up");
    expect(findExercise("Underwater basket weaving")).toBeUndefined();
  });

  it("allows failure on everything except heavy barbell compound lifts (SPEC decision 74)", () => {
    expect(failureAllowed(findExercise("Back squat")!)).toBe(false);
    expect(failureAllowed(findExercise("Deadlift")!)).toBe(false);
    expect(failureAllowed(findExercise("Bench press")!)).toBe(false);
    expect(failureAllowed(findExercise("Pull-up")!)).toBe(true);
    expect(failureAllowed(findExercise("Dumbbell bench press")!)).toBe(true);
    expect(failureAllowed(findExercise("Leg press")!)).toBe(true);
    expect(failureAllowed(findExercise("Lat pulldown")!)).toBe(true);
    expect(failureAllowed(findExercise("Dumbbell lateral raise")!)).toBe(true);
  });

  it("knows every exercise in the demo week, with failure flags that match", () => {
    for (const day of demoEngineWeek.days) {
      for (const s of day.sessions) {
        for (const e of s.exercises) {
          const info = findExercise(e.name);
          expect(info, e.name).toBeDefined();
          if (e.failure_allowed) expect(failureAllowed(info!)).toBe(true);
        }
      }
    }
  });

  it("sets rest times and weight steps by type of exercise", () => {
    expect(defaultRestSeconds(findExercise("Back squat")!)).toBe(180);
    expect(defaultRestSeconds(findExercise("Leg press")!)).toBe(120);
    expect(defaultRestSeconds(findExercise("Triceps pushdown")!)).toBe(75);
    expect(weightStepKg(findExercise("Bench press")!)).toBe(2.5);
    expect(weightStepKg(findExercise("Goblet squat")!)).toBe(2);
    expect(weightStepKg(findExercise("Push-up")!)).toBe(0);
  });

  it("marks main lifts, which stay the same within a block", () => {
    const main = EXERCISES.filter((e) => e.isMainLift).map((e) => e.name);
    expect(main).toEqual(expect.arrayContaining(["Back squat", "Deadlift", "Bench press", "Overhead press", "Pull-up"]));
  });
});
