import { describe, expect, it } from "vitest";
import { desiredVsPredicted, formatPaceBand, paceForRpe, predictRaceSeconds, RACE_KM } from "./paces";

describe("paces from a 5K", () => {
  it("predicts other races with Riegel's formula", () => {
    // A 25:00 5K predicts about 52:08 for 10K and about 3:59-4:00 for a marathon.
    expect(Math.round(predictRaceSeconds(1500, 10))).toBe(3127);
    expect(predictRaceSeconds(1500, RACE_KM.marathon) / 3600).toBeCloseTo(4, 1);
  });

  it("gives slower bands for easier efforts", () => {
    const easy = paceForRpe(1500, 3);
    const tempo = paceForRpe(1500, 7);
    const fast = paceForRpe(1500, 9);
    expect(easy.fromSecPerKm).toBeGreaterThan(tempo.fromSecPerKm);
    expect(tempo.fromSecPerKm).toBeGreaterThan(fast.fromSecPerKm);
    expect([easy.name, tempo.name, fast.name]).toEqual(["Easy", "Tempo", "5K effort"]);
  });

  it("formats bands per km or per mile, faster first", () => {
    const band = paceForRpe(1500, 9); // 5K pace is 5:00/km
    expect(formatPaceBand(band, "km")).toBe("4:51-5:00/km");
    expect(formatPaceBand(band, "mi")).toBe("7:48-8:03/mi");
  });

  it("notes a desired time clearly faster than the 5K predicts", () => {
    expect(desiredVsPredicted("10k", 45 * 60, 1500)).toMatch(/suggests about 52:07/);
    expect(desiredVsPredicted("10k", 52 * 60, 1500)).toBeNull();
    expect(desiredVsPredicted("half", 100 * 60, 1500)).toMatch(/suggests about 1:5/);
    expect(desiredVsPredicted("ultra", 600, 1500)).toBeNull();
  });
});
