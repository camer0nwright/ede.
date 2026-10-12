import { describe, expect, it } from "vitest";
import { CHECKER_CONFIG as C } from "@/server/plan-checker";
import { addDays } from "./dates";
import { Availability, type AvailabilityDay } from "./domain";
import {
  buildPlanOutline,
  easyShareOf,
  qualityOf,
  type OutlineInput,
  type OutlineWeek,
  type PlanOutline,
} from "./plan-outline";
import { RUN_LIBRARY } from "./session-library";

// Plans are checked against the plan checker's own limits (CHECKER_CONFIG),
// so the outline and the checker can't drift apart.

const day = (minutes: number | null, second?: number): AvailabilityDay =>
  second ? { minutes, isDouble: true, secondMinutes: second } : { minutes, isDouble: false, secondMinutes: null };

const typical = Availability.parse([day(60), day(45, 45), day(60), day(45), day(null), day(120), day(90)]);
const tight = Availability.parse([day(null), day(45), day(null), day(45), day(null), day(60), day(null)]);
const ultraWeek = Availability.parse([day(60), day(60, 45), day(75), day(60), day(null), day(360), day(240)]);

const base: OutlineInput = {
  startDate: "2026-10-12",
  goalType: "general",
  experienceLevel: "intermediate",
  strengthVolume: "low",
  availability: typical,
};

const PROFILES: Record<string, OutlineInput> = {
  "half marathon, intermediate": { ...base, goalType: "race", raceDistance: "half", targetDate: "2027-01-31", lastWeekRunMinutes: 150 },
  "beginner 5K": { ...base, goalType: "race", raceDistance: "5k", targetDate: "2026-12-20", experienceLevel: "beginner" },
  "marathon, advanced": { ...base, goalType: "race", raceDistance: "marathon", targetDate: "2027-03-07", experienceLevel: "advanced", lastWeekRunMinutes: 240 },
  "10K on tight availability": { ...base, goalType: "race", raceDistance: "10k", targetDate: "2026-12-13", availability: tight, lastWeekRunMinutes: 90 },
  "100-mile mountain ultra": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 161, terrain: "mountain", targetDate: "2027-04-04", experienceLevel: "advanced", availability: ultraWeek, lastWeekRunMinutes: 360 },
  "50K road ultra": { ...base, goalType: "race", raceDistance: "ultra", ultraDistanceKm: 50, terrain: "road", targetDate: "2027-02-14", availability: ultraWeek, lastWeekRunMinutes: 240 },
  "general fitness, no date": { ...base, lastWeekRunMinutes: 100 },
  "strength goal, moderate volume": { ...base, goalType: "strength", strengthVolume: "moderate", lastWeekRunMinutes: 80 },
};

const outlines = Object.entries(PROFILES).map(([name, input]) => [name, input, buildPlanOutline(input)] as const);

const total = (w: OutlineWeek) => w.runMinutes + w.strengthMinutes;
const isFull = (w: OutlineWeek) => w.phase !== "recovery" && w.phase !== "taper";

/** The last full (build) week before week index i. */
function lastBuild(o: PlanOutline, i: number) {
  return o.weeks.slice(0, i).findLast(isFull);
}

describe.each(outlines)("plan outline: %s", (_name, input, outline) => {
  const { weeks } = outline;
  const beginner = input.experienceLevel === "beginner";
  const ultra = input.raceDistance === "ultra";

  it("covers the whole plan, a week at a time from the Monday start", () => {
    weeks.forEach((w, i) => {
      expect(w.weekNumber).toBe(i + 1);
      expect(w.weekStart).toBe(addDays(input.startDate, i * 7));
    });
    if (input.targetDate) {
      const raceWeek = weeks.at(-1)!;
      expect(input.targetDate >= raceWeek.weekStart && input.targetDate <= addDays(raceWeek.weekStart, 6)).toBe(true);
    } else {
      expect(weeks).toHaveLength(8);
    }
  });

  it("ends with the taper and has a recovery week after at most 3 build weeks", () => {
    const taper = outline.taperWeeks;
    expect(weeks.slice(weeks.length - taper).every((w) => w.phase === "taper")).toBe(true);
    let streak = 0;
    for (const w of weeks) {
      if (w.phase === "recovery") {
        expect(streak).toBeGreaterThanOrEqual(C.minBuildWeeksBeforeRecovery);
        streak = 0;
      } else if (w.phase !== "taper") {
        streak++;
        expect(streak).toBeLessThanOrEqual(C.maxBuildWeeksInRow);
      }
    }
  });

  it("follows the run progression and starting-load rules", () => {
    weeks.forEach((w, i) => {
      if (!isFull(w)) return;
      const prevRun = i === 0 ? input.lastWeekRunMinutes : weeks[i - 1].runMinutes;
      if (prevRun === undefined || prevRun < C.startingLoadBelowMinutes) {
        const range = beginner ? C.startingRunMinutes.beginner : C.startingRunMinutes.other;
        expect(w.runMinutes, `week ${w.weekNumber}`).toBeGreaterThanOrEqual(range.min);
        expect(w.runMinutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(range.max);
        expect(w.runs.length).toBeGreaterThanOrEqual(C.startingRunSessions.min);
        expect(w.runs.length).toBeLessThanOrEqual(C.startingRunSessions.max);
      } else {
        const ref = lastBuild(outline, i)?.runMinutes ?? prevRun;
        const limit = ref + Math.max(ref * C.maxRunIncreaseShare, C.minRunIncreaseMinutes);
        expect(w.runMinutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(limit);
      }
    });
  });

  it("cuts recovery and taper weeks enough", () => {
    const shares = (input.ultraDistanceKm ?? 0) >= C.longUltraMinKm ? C.longUltraTaperShares : C.taperShares;
    weeks.forEach((w, i) => {
      const ref = lastBuild(outline, i);
      if (!ref) return;
      if (w.phase === "recovery") {
        expect(total(w)).toBeLessThanOrEqual(total(ref) * C.maxRecoveryWeekShare);
        // SPEC: recovery cuts volume by about 30-40%, running included.
        expect(w.runMinutes).toBeLessThanOrEqual(ref.runMinutes * 0.7);
      }
      if (w.phase === "taper") expect(total(w)).toBeLessThanOrEqual(total(ref) * shares[weeks.length - 1 - i]);
    });
  });

  it(`keeps at least ${ultra ? 90 : 80}% of running at easy effort`, () => {
    for (const w of weeks) expect(easyShareOf(w.runs), `week ${w.weekNumber}`).toBeGreaterThanOrEqual(ultra ? 0.9 : C.minEasyRunShare);
  });

  it("varies quality sessions week to week, and never steps a level back in build weeks", () => {
    const levels = new Map<string, number>();
    weeks.forEach((w, i) => {
      const q = qualityOf(w);
      const prev = i > 0 ? qualityOf(weeks[i - 1]) : [];
      if (q.length > 0 && prev.length > 0) {
        const same = q.length === prev.length && q.every((x) => prev.some((p) => p.kind === x.kind));
        expect(same, `week ${w.weekNumber} repeats last week's quality sessions`).toBe(false);
      }
      for (const { kind, level } of q) {
        if (isFull(w)) expect(level, `${kind} in week ${w.weekNumber}`).toBeGreaterThanOrEqual(levels.get(kind) ?? 1);
        levels.set(kind, level);
      }
    });
  });

  it("fits every run on an available day, with the long run the longest", () => {
    const caps = input.availability
      .filter((d) => d.minutes !== null)
      .map((d) => (d.minutes! >= 120 ? Infinity : d.minutes!))
      .sort((a, b) => b - a);
    for (const w of weeks) {
      const minutes = w.runs.map((r) => r.minutes).sort((a, b) => b - a);
      expect(minutes.length).toBeLessThanOrEqual(Math.min(caps.length, 6));
      minutes.forEach((m, k) => expect(m, `week ${w.weekNumber}`).toBeLessThanOrEqual(caps[k]));
      const long = w.runs.find((r) => r.role === "long" && !r.backToBack);
      if (long) expect(long.minutes).toBe(minutes[0]);
    }
  });

  it("only plans session kinds that suit the athlete", () => {
    for (const w of weeks) {
      for (const r of w.runs) {
        if (beginner) expect(RUN_LIBRARY[r.kind].intensity).toBe("easy");
        if (r.kind === "hill_hike" || r.kind === "long_hilly") expect(input.terrain).toMatch(/trail|mountain/);
        if (r.backToBack) expect(ultra).toBe(true);
      }
    }
  });

  it("plans hard strength sessions in build weeks, light ones in recovery and taper", () => {
    weeks.forEach((w, i) => {
      for (const s of w.strength) {
        if (!isFull(w)) expect(s.effort).toBe("light");
        else if (beginner && i < 4) expect(s.effort).toBe("technique");
        else expect(s.effort).toBe("hard");
        expect(s.variant).toBe(i % 2 === 0 ? "A" : "B");
      }
    });
    if (input.targetDate) {
      expect(weeks.at(-1)!.strength.every((s) => s.focus === "upper")).toBe(true);
    }
  });

  it("is the same every time for the same answers", () => {
    expect(buildPlanOutline(input)).toEqual(outline);
  });
});

describe("plan outline details", () => {
  const get = (name: string) => outlines.find(([n]) => n === name)![2];

  it("rotates a half marathon's quality sessions through tempo, intervals, progression and hills", () => {
    const kinds = new Set(get("half marathon, intermediate").weeks.flatMap((w) => qualityOf(w).map((q) => q.kind)));
    expect([...kinds].sort()).toEqual(["hills", "intervals_long", "progression", "tempo"]);
  });

  it("varies a half marathon's long runs with fast finishes", () => {
    const longs = new Set(get("half marathon, intermediate").weeks.flatMap((w) => w.runs.filter((r) => r.role === "long").map((r) => r.kind)));
    expect(longs).toContain("long_fast_finish");
  });

  it("gives beginners run/walk sessions that progress", () => {
    const levels = get("beginner 5K").weeks.map((w) => Math.max(...w.runs.map((r) => r.level)));
    expect(get("beginner 5K").weeks.every((w) => w.runs.every((r) => r.kind === "run_walk"))).toBe(true);
    expect(levels.at(-3)!).toBeGreaterThan(levels[0]);
  });

  it("builds back-to-back long runs into an ultra about 8, 5 and 3 weeks out", () => {
    const o = get("50K road ultra");
    const weeksOut = o.weeks.filter((w) => w.runs.some((r) => r.backToBack)).map((w) => o.weeks.length - w.weekNumber);
    expect(weeksOut.length).toBeGreaterThanOrEqual(2);
    expect(weeksOut.every((n) => [8, 5, 3].includes(n))).toBe(true);
  });

  it("uses hill and hiking sessions for mountain ultras, and a 3-week taper for 100 miles", () => {
    const o = get("100-mile mountain ultra");
    expect(o.taperWeeks).toBe(3);
    const kinds = new Set(o.weeks.flatMap((w) => w.runs.map((r) => r.kind)));
    expect(kinds).toContain("hill_hike");
    expect(kinds).toContain("long_hilly");
  });

  it("repeats 8-week blocks without a race, with recovery in weeks 4 and 8", () => {
    const o = get("general fitness, no date");
    expect(o.weeks.map((w) => w.phase)).toEqual(["base", "base", "base", "recovery", "build", "build", "build", "recovery"]);
  });

  it("plans more lifting for a strength goal", () => {
    const o = get("strength goal, moderate volume");
    expect(o.weeks.filter((w) => w.phase === "build").every((w) => w.strength.length === 3)).toBe(true);
    expect(o.weeks.every((w) => w.runs.length <= 2)).toBe(true);
  });

  it("notes a plan shorter than recommended and a missing ultra base", () => {
    const o = buildPlanOutline({ ...PROFILES["50K road ultra"], targetDate: "2026-12-06", lastWeekRunMinutes: 120 });
    expect(o.notes.join(" ")).toMatch(/plan is 8 weeks; about 12 weeks is recommended/);
    expect(o.notes.join(" ")).toMatch(/solid base/);
  });

  it("notes when available time limits the plan", () => {
    const o = get("10K on tight availability");
    expect(o.notes.join(" ")).toMatch(/available time limits running/);
  });

  it("refuses a start that isn't a Monday, or a target date before the start", () => {
    expect(() => buildPlanOutline({ ...base, startDate: "2026-10-13" })).toThrow(/Monday/);
    expect(() => buildPlanOutline({ ...base, goalType: "race", raceDistance: "5k", targetDate: "2026-10-01" })).toThrow(/before the plan starts/);
  });
});
