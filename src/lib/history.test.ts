import { describe, expect, it } from "vitest";
import { sessionKey, type CheckIn } from "./checkin";
import type { PlannedSession, WeekPlan } from "./domain";
import { estimatedOneRepMax, liftRecords, runRecords, weekHistory, weekStreak, type LiftSet } from "./history";

const set = (exercise: string, date: string, weightKg: number | null, reps: number, setType: LiftSet["setType"] = "working", sessionId = date): LiftSet => ({
  exercise,
  date,
  sessionId,
  setType,
  weightKg,
  reps,
});

describe("personal records", () => {
  it("estimates a one-rep max so different sets compare", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(Math.round(estimatedOneRepMax(80, 6))).toBe(96);
  });

  it("finds each lift's heaviest set and strongest estimate, ignoring warm-ups", () => {
    const records = liftRecords([
      set("Bench press", "2026-10-06", 100, 3, "warmup"),
      set("Bench press", "2026-10-06", 60, 8),
      set("Bench press", "2026-10-13", 62.5, 6),
      set("Bench press", "2026-10-13", 62.5, 5),
      set("Back squat", "2026-10-08", 90, 5),
    ]);
    expect(records.map((r) => r.exercise)).toEqual(["Back squat", "Bench press"]);
    const bench = records[1];
    expect(bench.best).toMatchObject({ weightKg: 62.5, reps: 6, date: "2026-10-13" });
    expect(bench.workouts).toBe(2);
    // 60 kg × 8 estimates slightly stronger than the heavier 62.5 kg × 6.
    expect(Math.round(bench.e1rmKg!)).toBe(76);
  });

  it("records bodyweight work by reps", () => {
    const [pullUps] = liftRecords([set("Pull-up", "2026-10-06", null, 8), set("Pull-up", "2026-10-13", null, 10)]);
    expect(pullUps.best).toMatchObject({ weightKg: null, reps: 10 });
    expect(pullUps.e1rmKg).toBeUndefined();
  });

  it("finds the longest, farthest and fastest runs (pace only from 3 km)", () => {
    const runs = runRecords([
      { date: "2026-10-06", minutes: 30, distanceKm: 6 },
      { date: "2026-10-08", minutes: 10, distanceKm: 2.5 }, // too short for a pace record
      { date: "2026-10-11", minutes: 75, distanceKm: 12 },
      { date: "2026-10-13", minutes: 40 },
    ]);
    expect(runs).toMatchObject({ longest: { minutes: 75, date: "2026-10-11" }, farthest: { km: 12 }, fastest: { secondsPerKm: 300, date: "2026-10-06" } });
    expect(runRecords([])).toBeNull();
  });
});

const run = (date: string, minutes: number, slot: 1 | 2 = 1): PlannedSession => ({
  date, slot, type: "run", title: "Easy run", intensity: "easy", plannedMinutes: minutes, isKeySession: false, steps: [],
});
const week = (weekStart: string, weekNumber: number, dates: string[]): WeekPlan => ({
  weekStart, weekNumber, phase: "base", dayNotes: {}, coachNote: "", sessions: dates.map((d) => run(d, 40)),
});
const done = (date: string): [string, CheckIn] => [sessionKey(date, 1), { status: "completed", actualMinutes: 45, effort: 5 }];

describe("week by week", () => {
  const weeks = [
    week("2026-09-28", 1, ["2026-09-29", "2026-10-01"]),
    week("2026-10-05", 2, ["2026-10-06", "2026-10-08"]),
    week("2026-10-12", 3, ["2026-10-13", "2026-10-15"]),
    week("2026-10-19", 4, ["2026-10-20"]),
  ];

  it("totals each week up to now, newest first", () => {
    const checkIns = Object.fromEntries([done("2026-10-06"), done("2026-10-08"), done("2026-10-13")]);
    const history = weekHistory(weeks, checkIns, "2026-10-14", [set("Bench press", "2026-10-07", 60, 5)], [{ date: "2026-10-06", minutes: 45, distanceKm: 8 }]);
    expect(history.map((w) => w.weekNumber)).toEqual([3, 2, 1]); // week 4 hasn't started
    expect(history[1]).toMatchObject({ sessions: 2, done: 2, runPlanned: 80, runDone: 45, distanceKm: 8, liftedKg: 300 });
  });

  it("counts a streak of weeks with at least half the sessions done", () => {
    const checkIns = Object.fromEntries([done("2026-09-29"), done("2026-10-06"), done("2026-10-08")]);
    const history = weekHistory(weeks, checkIns, "2026-10-14", [], []);
    // This week isn't at half yet, so it doesn't break the streak: weeks 2 and 1 count.
    expect(weekStreak(history, "2026-10-14")).toBe(2);
    // A missed week that's over breaks it.
    const missed = weekHistory(weeks, Object.fromEntries([done("2026-09-29")]), "2026-10-14", [], []);
    expect(weekStreak(missed, "2026-10-14")).toBe(0);
  });
});
