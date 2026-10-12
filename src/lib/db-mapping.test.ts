import { describe, expect, it } from "vitest";
import {
  exerciseToRow,
  fromKg,
  rowToPastWeek,
  rowToSession,
  sessionToRow,
  toKg,
  weekToRow,
} from "./db-mapping";
import { demoWeek } from "./demo-week";
import type { PlannedSession } from "./domain";
import { findExercise } from "./exercise-library";

describe("database mapping", () => {
  it("round-trips every demo session through a database row", () => {
    for (const s of demoWeek.sessions) expect(rowToSession(sessionToRow(s))).toEqual(s);
  });

  it("keeps a run's library kind and level", () => {
    const run: PlannedSession = {
      ...(demoWeek.sessions.find((s) => s.title === "Intervals") as PlannedSession),
      ...({ kind: "intervals_long", level: 3 } as object),
    } as PlannedSession;
    const back = rowToSession(sessionToRow(run));
    expect(back.type === "run" && [back.kind, back.level]).toEqual(["intervals_long", 3]);
  });

  it("refuses bad JSON from the database rather than passing it on", () => {
    const row = { ...sessionToRow(demoWeek.sessions[1]), exercises: JSON.stringify([{ name: "Squat" }]) };
    expect(() => rowToSession(row)).toThrow();
  });

  it("stores a week's run and strength minutes for next week's history", () => {
    const row = weekToRow(demoWeek);
    expect([row.runMinutes, row.strengthMinutes, row.phase]).toEqual([230, 80, "base"]);
    expect(rowToPastWeek({ ...row, quality: null })).toEqual({ totalMinutes: 310, runMinutes: 230, phase: "base" });
  });

  it("stores and reads back quality sessions for the variety rule", () => {
    const quality = JSON.stringify([{ kind: "tempo", level: 2 }]);
    expect(rowToPastWeek({ runMinutes: 200, strengthMinutes: 80, phase: "build", quality }).quality).toEqual([
      { kind: "tempo", level: 2 },
    ]);
  });

  it("turns library exercises into rows with failure, rest and weight step filled in", () => {
    expect(exerciseToRow(findExercise("Leg press")!)).toMatchObject({
      name: "Leg press",
      equipment: "machine",
      failureAllowed: true,
      defaultRestSeconds: 120,
      weightStepKg: 2.5,
      isMainLift: false,
    });
  });

  it("converts weights between kg and lb", () => {
    expect(toKg(100, "kg")).toBe(100);
    expect(toKg(220.462, "lb")).toBeCloseTo(100);
    expect(fromKg(100, "lb")).toBeCloseTo(220.46, 1);
  });
});
