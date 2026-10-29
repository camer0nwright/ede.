import { describe, expect, it } from "vitest";
import { desiredVsPredicted, ESTIMATED_5K_SECONDS, estimatedKm, fiveKFromRace, formatDistance, formatEstimate, formatPace, formatPaceBand, paceForRpe, predictRaceSeconds, RACE_KM } from "./paces";

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

  it("formats a single pace and a distance in either unit", () => {
    expect(formatPace(300, "km")).toBe("5:00/km");
    expect(formatPace(300, "mi")).toBe("8:03/mi");
    expect(formatDistance(8.2, "km")).toBe("8.2 km");
    expect(formatDistance(8.2, "mi")).toBe("5.1 mi");
  });
});

describe("paces from any recent race (SPEC decision 73)", () => {
  it("turns a recent race into the 5K time it implies", () => {
    expect(fiveKFromRace("5k", 1500)).toBe(1500);
    // A 50-minute 10K implies about a 24-minute 5K.
    expect(fiveKFromRace("10k", 50 * 60)).toBeGreaterThan(23 * 60);
    expect(fiveKFromRace("10k", 50 * 60)).toBeLessThan(25 * 60);
    // Round trip with the race prediction.
    const five = 25 * 60;
    expect(fiveKFromRace("half", predictRaceSeconds(five, RACE_KM.half))).toBeCloseTo(five, -1);
    expect(fiveKFromRace("marathon", predictRaceSeconds(five, RACE_KM.marathon))).toBeCloseTo(five, -1);
  });

  it("has a sensible estimate for each experience level, fastest for advanced", () => {
    expect(ESTIMATED_5K_SECONDS.beginner).toBeGreaterThan(ESTIMATED_5K_SECONDS.intermediate);
    expect(ESTIMATED_5K_SECONDS.intermediate).toBeGreaterThan(ESTIMATED_5K_SECONDS.advanced);
  });
});

describe("estimated run distance (SPEC decision 73)", () => {
  const fiveK = 25 * 60; // 5:00/km

  it("adds up each step at the middle of its pace band", () => {
    // 50 easy minutes at 6:00-6:54/km (middle about 6:27) is about 7.75 km.
    const km = estimatedKm([{ minutes: 50, targetRpe: 3 }], fiveK);
    expect(km).toBeGreaterThan(7.5);
    expect(km).toBeLessThan(8);
  });

  it("counts faster steps as covering more ground", () => {
    const easy = estimatedKm([{ minutes: 30, targetRpe: 3 }], fiveK);
    const tempo = estimatedKm([{ minutes: 30, targetRpe: 7 }], fiveK);
    expect(tempo).toBeGreaterThan(easy);
  });

  it("shows the estimate to the nearest half, in the athlete's unit", () => {
    expect(formatEstimate(7.74, "km")).toBe("≈ 7.5 km");
    expect(formatEstimate(8, "km")).toBe("≈ 8 km");
    expect(formatEstimate(8.1, "mi")).toBe("≈ 5 mi");
  });
});
