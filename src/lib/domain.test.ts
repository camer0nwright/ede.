import { describe, expect, it } from "vitest";
import {
  Availability,
  CheckIn,
  PlannedSession,
  summariseAvailability,
  WeekPlan,
} from "./domain";

const rest = { minutes: null };
const sixty = { minutes: 60 };

describe("PlannedSession", () => {
  it("accepts a run with steps", () => {
    const s = PlannedSession.parse({
      date: "2026-10-15",
      type: "run",
      title: "Intervals",
      intensity: "hard",
      plannedMinutes: 45,
      isKeyRun: true,
      steps: [{ kind: "interval", minutes: 4, repeat: 4, description: "Hard" }],
    });
    expect(s.type).toBe("run");
    expect(s.slot).toBe(1);
  });

  it("accepts a strength session and defaults isLegs to false", () => {
    const s = PlannedSession.parse({
      date: "2026-10-13",
      type: "strength",
      title: "Upper body",
      intensity: "moderate",
      plannedMinutes: 45,
      steps: [{ name: "Bench press", sets: 4, reps: "6" }],
    });
    expect(s.type === "strength" && s.steps[0].isLegs).toBe(false);
  });

  it("rejects session types other than run and strength", () => {
    const result = PlannedSession.safeParse({
      date: "2026-10-13",
      type: "swim",
      title: "Pool",
      intensity: "easy",
      plannedMinutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bad date and a zero duration", () => {
    const base = { type: "run", title: "Run", intensity: "easy" };
    expect(
      PlannedSession.safeParse({ ...base, date: "13/10/2026", plannedMinutes: 30 })
        .success,
    ).toBe(false);
    expect(
      PlannedSession.safeParse({ ...base, date: "2026-10-13", plannedMinutes: 0 })
        .success,
    ).toBe(false);
  });
});

describe("WeekPlan", () => {
  it("allows an empty week (all rest)", () => {
    expect(WeekPlan.parse({ weekStart: "2026-10-12", sessions: [] }).sessions).toEqual(
      [],
    );
  });
});

describe("CheckIn", () => {
  it("requires a reason when skipping", () => {
    expect(CheckIn.safeParse({ status: "skipped" }).success).toBe(false);
    expect(CheckIn.safeParse({ status: "skipped", skipReason: "illness" }).success).toBe(
      true,
    );
  });

  it("keeps effort between 1 and 10", () => {
    expect(CheckIn.safeParse({ status: "completed", effort: 11 }).success).toBe(false);
    expect(CheckIn.safeParse({ status: "completed", effort: 7 }).success).toBe(true);
  });
});

describe("Availability", () => {
  it("needs exactly seven days", () => {
    expect(Availability.safeParse([sixty, sixty]).success).toBe(false);
  });

  it("needs both times on a double day", () => {
    const week = [rest, sixty, sixty, sixty, rest, sixty, { minutes: 60, isDouble: true }];
    expect(Availability.safeParse(week).success).toBe(false);
  });

  it("does not allow a rest day to be a double day", () => {
    const week = [rest, sixty, sixty, sixty, rest, sixty, { minutes: null, isDouble: true, secondMinutes: 30 }];
    expect(Availability.safeParse(week).success).toBe(false);
  });

  it("summarises training, double and rest days", () => {
    const week = Availability.parse([
      rest,
      sixty,
      { minutes: 45, isDouble: true, secondMinutes: 45 },
      sixty,
      rest,
      { minutes: 90 },
      sixty,
    ]);
    expect(summariseAvailability(week)).toEqual({
      trainingDays: 5,
      doubleDays: 1,
      restDays: 2,
    });
  });
});
