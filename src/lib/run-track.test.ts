import { describe, expect, it } from "vitest";
import { cleanTrack, currentStep, distanceM, formatClock, formatPace, keepPoint, movingMs, routeToSave, summarise, TRACK_CONFIG, type TrackPoint } from "./run-track";

// Recording a run with GPS (SPEC decision 82).

const START = Date.UTC(2026, 9, 30, 7, 0, 0);
/** Metres north of a starting point in London, as latitude. */
const north = (m: number) => 51.5 + m / 111_195;
/** A steady run north: one fix every 2 seconds at this many metres per second. */
const run = (seconds: number, mps = 3, from = 0, t0 = START): TrackPoint[] =>
  Array.from({ length: seconds / 2 + 1 }, (_, i) => ({ lat: north(from + i * 2 * mps), lng: -0.12, t: t0 + i * 2000, acc: 5 }));

describe("distance between points", () => {
  it("is right to within a metre over a kilometre", () => {
    expect(distanceM({ lat: north(0), lng: -0.12 }, { lat: north(1000), lng: -0.12 })).toBeCloseTo(1000, 0);
  });
});

describe("which GPS fixes count", () => {
  const last = run(0)[0];

  it("drops inaccurate fixes and ones from before the last", () => {
    expect(keepPoint(last, { ...last, lat: north(10), t: START + 3000, acc: TRACK_CONFIG.maxAccuracyM + 1 })).toBe(false);
    expect(keepPoint(last, { ...last, lat: north(10), t: START - 1000 })).toBe(false);
  });

  it("drops wobble while standing still, and jumps faster than anyone runs", () => {
    expect(keepPoint(last, { ...last, lat: north(1), t: START + 2000 })).toBe(false);
    expect(keepPoint(last, { ...last, lat: north(100), t: START + 2000 })).toBe(false);
    expect(keepPoint(last, { ...last, lat: north(8), t: START + 2000 })).toBe(true);
  });

  it("drops fixes while paused, and keeps the first one after", () => {
    const pause = { from: START + 1000, to: START + 60_000 };
    expect(keepPoint(last, { ...last, lat: north(6), t: START + 2000 }, [pause])).toBe(false);
    expect(keepPoint(last, { ...last, lat: north(500), t: START + 61_000 }, [pause])).toBe(true);
  });

  it("puts fixes back in time order", () => {
    const points = run(10);
    expect(cleanTrack([...points].reverse())).toEqual(points);
  });
});

describe("a recorded run", () => {
  it("adds up distance, moving time and pace", () => {
    // 20 minutes at 3 m/s: 3.6 km at 5:33/km.
    const s = summarise(run(1200), START, START + 1_200_000);
    expect(s.distanceKm).toBeCloseTo(3.6, 2);
    expect(s.movingSeconds).toBe(1200);
    expect(s.paceSecondsPerKm).toBeCloseTo(333.3, 0);
  });

  it("ignores a GPS jump in the middle", () => {
    const points = run(600);
    points[100] = { ...points[100], lat: north(5000) };
    expect(summarise(points, START, START + 600_000).distanceKm).toBeCloseTo(1.8, 1);
  });

  it("leaves out paused time and the distance covered while paused", () => {
    const first = run(300);
    const second = run(300, 3, 2000, START + 400_000);
    const s = summarise([...first, ...second], START, START + 700_000, [{ from: START + 300_000, to: START + 400_000 }]);
    expect(s.movingSeconds).toBe(600);
    expect(s.distanceKm).toBeCloseTo(1.8, 1);
  });

  it("counts nothing during a pause that hasn't ended yet", () => {
    const s = summarise(run(600), START, START + 600_000, [{ from: START + 300_000, to: Infinity }]);
    expect(s.movingSeconds).toBe(300);
    expect(s.distanceKm).toBeCloseTo(0.9, 1);
  });

  it("has no pace until it has gone somewhere", () => {
    expect(summarise([], START, START + 10_000).paceSecondsPerKm).toBeNull();
  });

  it("counts moving time only between start and end", () => {
    expect(movingMs(START, START + 60_000, [{ from: START + 50_000, to: START + 90_000 }])).toBe(50_000);
  });
});

describe("following the planned steps", () => {
  const steps = [{ minutes: 10 }, { minutes: 20 }, { minutes: 5 }];

  it("says which step the run is on and how long is left", () => {
    expect(currentStep(steps, 0)).toEqual({ index: 0, secondsLeft: 600 });
    expect(currentStep(steps, 615)).toEqual({ index: 1, secondsLeft: 1185 });
    expect(currentStep(steps, 2099)).toEqual({ index: 2, secondsLeft: 1 });
  });

  it("is past the plan once every step is done", () => {
    expect(currentStep(steps, 2100)).toBeNull();
  });
});

describe("showing it", () => {
  it("formats pace per km and per mile", () => {
    expect(formatPace(330)).toBe("5:30");
    expect(formatPace(330, "mi")).toBe("8:51");
    expect(formatPace(null)).toBe("–:––");
  });

  it("formats the clock", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("the saved route", () => {
  it("keeps only good points, rounded, and never too many", () => {
    const long = run(TRACK_CONFIG.maxPoints * 6);
    const saved = routeToSave(long);
    expect(saved.length).toBeLessThanOrEqual(TRACK_CONFIG.maxPoints + 1);
    expect(saved.at(-1)!.t).toBe(long.at(-1)!.t);
    expect(String(saved[1].lat).split(".")[1].length).toBeLessThanOrEqual(5);
  });
});
