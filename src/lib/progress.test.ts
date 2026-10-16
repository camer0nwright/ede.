import { describe, expect, it } from "vitest";
import type { LiftSet, WeekHistory } from "./history";
import { liftChange, liftSeries, liftValue, minuteScale, niceScale, rangeScale, weeklySeries } from "./progress";

const set = (exercise: string, date: string, weightKg: number | null, reps: number | null, setType: LiftSet["setType"] = "working", sessionId = date): LiftSet => ({
  exercise,
  date,
  sessionId,
  setType,
  weightKg,
  reps,
});

const week = (n: number, extra: Partial<WeekHistory> = {}): WeekHistory => ({
  weekStart: `2026-10-${String(n).padStart(2, "0")}`,
  weekNumber: n,
  phase: "base",
  sessions: 5,
  done: 4,
  skipped: 0,
  runPlanned: 120,
  runDone: 100,
  distanceKm: 15,
  liftedKg: 3000,
  ...extra,
});

describe("weekly series", () => {
  it("puts the weeks oldest first for the charts", () => {
    const series = weeklySeries([week(3), week(2), week(1)]);
    expect(series.map((w) => w.weekNumber)).toEqual([1, 2, 3]);
    expect(series[0]).toEqual({ weekStart: "2026-10-01", weekNumber: 1, runDone: 100, runPlanned: 120, distanceKm: 15, liftedKg: 3000 });
  });

  it("keeps only the most recent weeks", () => {
    const history = Array.from({ length: 20 }, (_, i) => week(20 - i));
    const series = weeklySeries(history, 12);
    expect(series).toHaveLength(12);
    expect(series[0].weekNumber).toBe(9);
    expect(series.at(-1)!.weekNumber).toBe(20);
  });

  it("is empty with no history", () => {
    expect(weeklySeries([])).toEqual([]);
  });
});

describe("lift series", () => {
  it("takes each workout's strongest set by estimated max, in date order", () => {
    const [bench] = liftSeries([
      set("Bench press", "2026-10-13", 62.5, 6),
      set("Bench press", "2026-10-13", 65, 3),
      set("Bench press", "2026-10-06", 60, 8),
    ]);
    expect(bench.weighted).toBe(true);
    expect(bench.points.map((p) => p.date)).toEqual(["2026-10-06", "2026-10-13"]);
    // 62.5 × 6 (est. 75) beats 65 × 3 (est. 71.5).
    expect(bench.points[1].best).toEqual({ weightKg: 62.5, reps: 6 });
    expect(bench.points[1].e1rmKg).toBeCloseTo(75);
  });

  it("leaves out warm-ups and sets without reps", () => {
    const [squat] = liftSeries([
      set("Back squat", "2026-10-08", 120, 3, "warmup"),
      set("Back squat", "2026-10-08", 140, null),
      set("Back squat", "2026-10-08", 90, 5),
    ]);
    expect(squat.points).toHaveLength(1);
    expect(squat.points[0].best).toEqual({ weightKg: 90, reps: 5 });
  });

  it("measures bodyweight work by most reps", () => {
    const [pullUps] = liftSeries([set("Pull-up", "2026-10-06", null, 6), set("Pull-up", "2026-10-06", null, 8), set("Pull-up", "2026-10-13", null, 9)]);
    expect(pullUps.weighted).toBe(false);
    expect(pullUps.points.map(liftValue)).toEqual([8, 9]);
    expect(pullUps.points[0].e1rmKg).toBeUndefined();
  });

  it("skips unloaded workouts of a weighted exercise", () => {
    const [dips] = liftSeries([set("Dip", "2026-10-06", null, 10), set("Dip", "2026-10-13", 10, 8)]);
    expect(dips.weighted).toBe(true);
    expect(dips.points.map((p) => p.date)).toEqual(["2026-10-13"]);
  });

  it("keeps two workouts on the same day apart", () => {
    const [bench] = liftSeries([set("Bench press", "2026-10-06", 60, 5, "working", "a"), set("Bench press", "2026-10-06", 62.5, 5, "working", "b")]);
    expect(bench.points).toHaveLength(2);
  });

  it("lists the most-logged exercises first", () => {
    const series = liftSeries([
      set("Row", "2026-10-06", 50, 8),
      set("Bench press", "2026-10-06", 60, 8),
      set("Bench press", "2026-10-13", 60, 9),
      set("Back squat", "2026-10-08", 80, 5),
    ]);
    expect(series.map((s) => s.exercise)).toEqual(["Bench press", "Back squat", "Row"]);
  });

  it("measures the change from the first workout to the latest", () => {
    const [bench] = liftSeries([set("Bench press", "2026-10-06", 60, 5), set("Bench press", "2026-10-13", 65, 5)]);
    expect(liftChange(bench)).toBeCloseTo(65 * (1 + 5 / 30) - 60 * (1 + 5 / 30));
    expect(liftChange({ ...bench, points: bench.points.slice(0, 1) })).toBeNull();
  });
});

describe("axis scales", () => {
  it("rounds the top up to a tidy step", () => {
    expect(niceScale(170)).toEqual({ top: 200, values: [0, 50, 100, 150, 200] });
    expect(niceScale(9)).toEqual({ top: 10, values: [0, 2.5, 5, 7.5, 10] });
    expect(niceScale(4000).top).toBe(4000);
  });

  it("still draws an empty chart", () => {
    expect(niceScale(0)).toEqual({ top: 4, values: [0, 1, 2, 3, 4] });
  });

  it("frames a lift's range without starting at zero", () => {
    const scale = rangeScale(70, 82);
    expect(scale.bottom).toBeLessThanOrEqual(70);
    expect(scale.bottom).toBeGreaterThan(0);
    expect(scale.top).toBeGreaterThanOrEqual(82);
    expect(scale.values[0]).toBe(scale.bottom);
    expect(scale.values.at(-1)).toBe(scale.top);
  });

  it("gives a single value some room", () => {
    const scale = rangeScale(75, 75);
    expect(scale.bottom).toBeLessThan(75);
    expect(scale.top).toBeGreaterThan(75);
  });

  it("steps running time in quarter hours, half hours or hours", () => {
    expect(minuteScale(50)).toEqual({ top: 60, values: [0, 15, 30, 45, 60] });
    expect(minuteScale(100)).toEqual({ top: 120, values: [0, 30, 60, 90, 120] });
    expect(minuteScale(170)).toEqual({ top: 180, values: [0, 60, 120, 180] });
    expect(minuteScale(400).top).toBe(480);
    expect(minuteScale(0)).toEqual({ top: 15, values: [0, 15] });
  });
});
