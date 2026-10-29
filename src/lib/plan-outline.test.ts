import { describe, expect, it } from "vitest";
import { CHECKER_CONFIG as C } from "@/server/plan-checker";
import { addDays } from "./dates";
import { dayCap, isUpperOnly } from "./domain";
import { base, PROFILES } from "@/test/profiles";
import {
  buildPlanOutline,
  easyShareOf,
  qualityOf,
  type OutlineInput,
  type OutlineWeek,
  type PlanOutline,
  raceSwap,
  recommendedSessions,
  swapLiftForRun,
} from "./plan-outline";
import { RUN_LIBRARY } from "./session-library";

// Plans are checked against the plan checker's own limits (CHECKER_CONFIG),
// so the outline and the checker can't drift apart.

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

  it("puts build or peak weeks, never a recovery week, right before the taper", () => {
    if (!input.targetDate || weeks.length < outline.taperWeeks + 3) return;
    const beforeTaper = weeks.slice(weeks.length - outline.taperWeeks - 2, weeks.length - outline.taperWeeks);
    expect(beforeTaper.map((w) => w.phase)).toEqual(["peak", "peak"]);
  });

  it("follows the run progression and starting-load rules", () => {
    weeks.forEach((w, i) => {
      if (!isFull(w)) return;
      const prevRun = i === 0 ? input.lastWeekRunMinutes : weeks[i - 1].runMinutes;
      const lastFull = lastBuild(outline, i)?.runMinutes ?? prevRun;
      if (lastFull === undefined || lastFull < C.startingLoadBelowMinutes) {
        const range = beginner ? C.startingRunMinutes.beginner : C.startingRunMinutes.other;
        expect(w.runMinutes, `week ${w.weekNumber}`).toBeGreaterThanOrEqual(range.min);
        expect(w.runMinutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(range.max);
        expect(w.runs.length).toBeGreaterThanOrEqual(C.startingRunSessions.min);
        expect(w.runs.length).toBeLessThanOrEqual(C.startingRunSessions.max);
      } else {
        const ref = lastFull;
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
      .map((d) => dayCap(d.minutes!, ultra))
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
    // (Chosen lift counts are covered by the "exactly the chosen" test.)
    weeks.forEach((w, i) => {
      for (const s of w.strength) {
        if (!isFull(w)) expect(s.effort).toBe("light");
        else if (beginner && i < 4) expect(s.effort).toBe("technique");
        else expect(s.effort).toBe("hard");
        expect(s.variant).toBe(i % 2 === 0 ? "A" : "B");
      }
    });
    if (input.targetDate) {
      expect(weeks.at(-1)!.strength.every((s) => isUpperOnly(s.focus))).toBe(true);
    }
  });

  it("keeps at least 2 lifts in build weeks, and a light lift in recovery weeks", () => {
    const slots = input.availability.filter((d) => d.minutes !== null).length + input.availability.filter((d) => d.isDouble).length;
    for (const w of weeks) {
      if (isFull(w) && slots >= 5) expect(w.strength.length, `week ${w.weekNumber}`).toBeGreaterThanOrEqual(2);
      if (w.phase === "recovery") expect(w.strength.length, `week ${w.weekNumber}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps quality sessions coming through the plan (non-beginners)", () => {
    if (beginner) return;
    const build = weeks.filter((w) => w.phase === "build" || w.phase === "peak");
    if (build.length < 4) return;
    const withQuality = build.filter((w) => qualityOf(w).length > 0).length;
    expect(withQuality / build.length).toBeGreaterThanOrEqual(0.7);
  });

  it("never makes a quality session longer than the long run (it doesn't take the long day)", () => {
    for (const w of weeks) {
      const long = w.runs.find((r) => r.role === "long");
      if (!long) continue;
      for (const q of w.runs.filter((r) => r.role === "quality")) expect(q.minutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(long.minutes);
    }
  });

  it("gives the chosen runs and lifts every week (fewer runs only in noted build-up weeks; near a race one lift can become a run)", () => {
    if (input.runsPerWeek === undefined) return;
    const noted = outline.notes.find((n) => /fewer than the \d+ runs you chose/.test(n));
    for (const w of weeks) {
      const swapped = w.strength.length === input.liftsPerWeek! - 1;
      if (swapped) {
        expect(raceSwap(input, w.phase, input.liftsPerWeek!), `week ${w.weekNumber} swapped outside build/peak`).toBe(true);
        continue;
      }
      expect(w.strength.length, `lifts in week ${w.weekNumber}`).toBe(input.liftsPerWeek);
      if (w.runs.length !== input.runsPerWeek) {
        expect(noted, `week ${w.weekNumber} has ${w.runs.length} runs with no note`).toBeDefined();
        expect(w.runs.length).toBeLessThan(input.runsPerWeek);
      }
    }
  });

  it("grows the long run by at most 10 minutes a week, from the longest recent run", () => {
    let lastFull: number | undefined;
    for (const w of weeks) {
      const long = w.runs.find((r) => r.role === "long" && !r.backToBack);
      if (!long || !isFull(w)) continue;
      const quality = Math.max(0, ...w.runs.filter((r) => r.role === "quality").map((r) => r.minutes));
      const start = input.longestRecentRunMinutes;
      if (lastFull === undefined && start !== undefined) expect(long.minutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(Math.max(start, quality) + 5);
      if (lastFull !== undefined) expect(long.minutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(Math.max(lastFull + 10, quality) + 5);
      lastFull = Math.max(long.minutes, lastFull ?? 0);
    }
  });

  it("keeps easy runs clearly shorter than the long run", () => {
    for (const w of weeks) {
      const long = w.runs.find((r) => r.role === "long");
      if (!long) continue;
      for (const e of w.runs.filter((r) => r.role === "easy")) expect(e.minutes, `week ${w.weekNumber}`).toBeLessThanOrEqual(Math.max(20, long.minutes * 0.75) + 5);
    }
  });

  it("is the same every time for the same answers", () => {
    expect(buildPlanOutline(input)).toEqual(outline);
  });
});

describe("plan outline details", () => {
  const get = (name: string) => outlines.find(([n]) => n === name)![2];

  it("caps a just-finish 10K's long run around an hour (your example)", () => {
    const o = get("10K just finish (your example)");
    expect(Math.max(...o.weeks.flatMap((w) => w.runs.filter((r) => r.role === "long").map((r) => r.minutes)))).toBeLessThanOrEqual(70);
  });

  it("gives just-finish plans gentle quality sessions, never hard intervals", () => {
    for (const name of ["10K just finish (your example)", "half marathon just finish, beginner"]) {
      for (const w of get(name).weeks) {
        for (const r of w.runs) expect(["intervals_short", "intervals_long", "long_race_pace"], `${name} week ${w.weekNumber}`).not.toContain(r.kind);
      }
    }
  });

  it("caps long runs by distance and goal: a time-goal 10K goes longer than a just-finish one", () => {
    const peakLong = (input: OutlineInput) => Math.max(...buildPlanOutline(input).weeks.flatMap((w) => w.runs.filter((r) => r.role === "long").map((r) => r.minutes)));
    const finish = PROFILES["10K just finish (your example)"];
    expect(peakLong({ ...finish, justFinish: false })).toBeGreaterThan(peakLong(finish));
  });

  it("keeps building a beginner after a recovery week instead of restarting", () => {
    const o = get("half marathon just finish, beginner");
    const peak = Math.max(...o.weeks.map((w) => w.runMinutes));
    expect(peak).toBeGreaterThan(120);
  });

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

  it("grows a short-weekday ultra well past its starting load instead of stalling", () => {
    const o = get("100K trail ultra, short weekdays");
    const peak = Math.max(...o.weeks.map((w) => w.runMinutes));
    expect(peak).toBeGreaterThanOrEqual(450);
    expect(o.notes.join(" ")).toMatch(/available time limits running/);
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
    expect(o.weeks.filter((w) => w.phase === "build").every((w) => w.strength.length === 4)).toBe(true);
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

describe("run and gym balance (SPEC decision 72)", () => {
  const rec = (goalType: "race" | "general" | "strength", raceDistance?: "5k" | "10k" | "half" | "marathon" | "ultra", experienceLevel: "beginner" | "intermediate" | "advanced" = "intermediate") =>
    recommendedSessions({ goalType, raceDistance, experienceLevel, strengthVolume: "low", justFinish: false });

  it("suggests close to even running and lifting", () => {
    expect(rec("race", "5k")).toEqual({ runs: 3, lifts: 3 });
    expect(rec("race", "10k")).toEqual({ runs: 3, lifts: 3 });
    expect(rec("race", "half")).toEqual({ runs: 3, lifts: 3 });
    expect(rec("general")).toEqual({ runs: 3, lifts: 3 });
  });

  it("adds a run for a marathon or ultra, and lifts for a strength goal", () => {
    expect(rec("race", "marathon")).toEqual({ runs: 4, lifts: 3 });
    expect(rec("race", "ultra")).toEqual({ runs: 4, lifts: 3 });
    expect(rec("strength")).toEqual({ runs: 2, lifts: 4 });
  });

  it("starts beginners on two of each, and doesn't add runs for advanced", () => {
    expect(rec("race", "half", "beginner")).toEqual({ runs: 2, lifts: 2 });
    expect(rec("race", "half", "advanced")).toEqual({ runs: 3, lifts: 3 });
  });

  it("swaps a lift for a run only in build and peak weeks of a race plan, keeping two lifts", () => {
    const race = { goalType: "race" as const, targetDate: "2027-03-01" };
    expect(raceSwap(race, "build", 3)).toBe(true);
    expect(raceSwap(race, "peak", 3)).toBe(true);
    for (const phase of ["base", "recovery", "taper"] as const) expect(raceSwap(race, phase, 3)).toBe(false);
    expect(raceSwap(race, "build", 2)).toBe(false);
    expect(raceSwap({ goalType: "general" }, "build", 3)).toBe(false);
  });

  describe("turning a lift into a run", () => {
    const race = { goalType: "race" as const, targetDate: "2027-03-01" };
    const runs = [
      { role: "quality" as const, kind: "tempo" as const, level: 2, minutes: 45 },
      { role: "long" as const, kind: "long_easy" as const, level: 1, minutes: 90 },
      { role: "easy" as const, kind: "strides" as const, level: 1, minutes: 50 },
    ];
    const lifts = [
      { focus: "lower" as const, variant: "A" as const, effort: "hard" as const, minutes: 55 },
      { focus: "upper" as const, variant: "A" as const, effort: "hard" as const, minutes: 55 },
      { focus: "full" as const, variant: "A" as const, effort: "hard" as const, minutes: 55 },
    ];
    const days = [120, 60, 60, 60, 60];

    it("splits the longest easy run in two and drops the full-body lift", () => {
      const out = swapLiftForRun("build", runs, lifts, race, days);
      expect(out.runs.map((r) => r.minutes)).toEqual([45, 90, 25, 25]);
      expect(out.runs.at(-1)).toMatchObject({ role: "easy", kind: "easy" });
      expect(out.runs.reduce((s, r) => s + r.minutes, 0)).toBe(185); // running unchanged
      expect(out.strength.map((x) => x.focus)).toEqual(["lower", "upper"]);
    });

    it("keeps the week when no easy run is long enough to split, or the runs wouldn't fit the days", () => {
      const short = runs.map((r) => (r.role === "easy" ? { ...r, minutes: 35 } : r));
      expect(swapLiftForRun("build", short, lifts, race, days)).toEqual({ runs: short, strength: lifts });
      expect(swapLiftForRun("build", runs, lifts, race, [120, 60, 60])).toEqual({ runs, strength: lifts });
      expect(swapLiftForRun("base", runs, lifts, race, days)).toEqual({ runs, strength: lifts });
    });
  });
});
