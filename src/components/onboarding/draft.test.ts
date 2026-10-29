import { describe, expect, it } from "vitest";
import { fiveKSeconds, recentSeconds, START, stepProblem, type Draft } from "./draft";

const with_ = (patch: Partial<Draft>): Draft => ({ ...START, ...patch });

describe("a recent race time in setup (SPEC decision 73)", () => {
  it("reads minutes and seconds for a 5K or 10K", () => {
    expect(recentSeconds(with_({ recentDistance: "5k", fiveKMin: "24", fiveKSec: "30" }))).toBe(24 * 60 + 30);
    expect(fiveKSeconds(with_({ recentDistance: "5k", fiveKMin: "24", fiveKSec: "30" }))).toBe(24 * 60 + 30);
  });

  it("reads hours too for a half or marathon, and turns any race into a 5K time", () => {
    const half = with_({ recentDistance: "half", recentHours: "1", fiveKMin: "50", fiveKSec: "0" });
    expect(recentSeconds(half)).toBe(6600);
    const five = fiveKSeconds(half)!;
    expect(five).toBeGreaterThan(23 * 60);
    expect(five).toBeLessThan(25 * 60);
  });

  it("is optional, and checks a time that can't be right", () => {
    expect(fiveKSeconds(with_({}))).toBeUndefined();
    const base = { experienceLevel: "intermediate" as const, lastWeekRunMinutes: 60, longestRecentRunMinutes: 30 };
    expect(stepProblem("experience", with_({ ...base }))).toBeNull();
    expect(stepProblem("experience", with_({ ...base, recentDistance: "5k", fiveKMin: "5" }))).toMatch(/recent race time/);
  });
});
