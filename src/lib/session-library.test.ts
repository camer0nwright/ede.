import { describe, expect, it } from "vitest";
import { EASY_MAX_RPE, RUN_KINDS } from "./domain";
import { buildRunSteps, maxLevel, minMinutes, RUN_LIBRARY } from "./session-library";

const sum = (xs: { minutes: number }[]) => xs.reduce((s, x) => s + x.minutes, 0);

describe("session library", () => {
  it("has an entry for every run kind", () => {
    expect(Object.keys(RUN_LIBRARY).sort()).toEqual([...RUN_KINDS].sort());
  });

  it.each(RUN_KINDS)("%s: steps add up to the session length at every level", (kind) => {
    for (let level = 1; level <= maxLevel(kind); level++) {
      const minutes = minMinutes(kind, level) + 10;
      expect(sum(buildRunSteps(kind, level, minutes))).toBe(minutes);
    }
  });

  it("makes quality sessions harder as the level goes up", () => {
    for (const kind of RUN_KINDS.filter((k) => RUN_LIBRARY[k].role === "quality")) {
      // "Harder" means more hard work, not more total time (shorter reps can need less jogging between).
      const work = RUN_LIBRARY[kind].levels.map((l) => l.work);
      for (let i = 1; i < work.length; i++) expect(work[i], `${kind} level ${i + 1}`).toBeGreaterThan(work[i - 1]);
      expect(maxLevel(kind)).toBeGreaterThanOrEqual(4);
    }
  });

  it("wraps quality sessions in an easy warm-up and cool-down", () => {
    const steps = buildRunSteps("intervals_short", 2, 45);
    expect(steps.map((s) => s.name)).toEqual([
      "Warm-up: easy jog",
      "8 × 1 min hard, 1 min easy jog between",
      "Cool-down: easy jog",
    ]);
    expect(steps[0].targetRpe).toBeLessThanOrEqual(EASY_MAX_RPE);
    expect(steps[2].targetRpe).toBeLessThanOrEqual(EASY_MAX_RPE);
    expect(steps[1].targetRpe).toBe(9);
  });

  it("keeps easy, run/walk and long easy runs entirely at easy effort", () => {
    for (const kind of ["easy", "recovery", "run_walk", "long_easy", "long_hilly"] as const) {
      for (let level = 1; level <= maxLevel(kind); level++) {
        expect(buildRunSteps(kind, level, 60).every((s) => s.targetRpe <= EASY_MAX_RPE)).toBe(true);
      }
    }
  });

  it("puts a fast finish at the end of a long run", () => {
    const steps = buildRunSteps("long_fast_finish", 2, 90);
    expect(steps).toEqual([
      { name: "Easy, conversational pace", minutes: 75, targetRpe: 4 },
      { name: "15 min fast finish, strong but controlled", minutes: 15, targetRpe: 7 },
    ]);
  });

  it("progresses beginners from run/walk to continuous running", () => {
    const names = RUN_LIBRARY.run_walk.levels.map((l) => l.main);
    expect(names[0]).toBe("Run 1 min, walk 1 min, repeat");
    expect(names.at(-1)).toBe("Easy continuous running");
  });

  it("clamps levels into range", () => {
    expect(buildRunSteps("tempo", 99, 60)[1].name).toBe("30 min at tempo effort, comfortably hard");
    expect(buildRunSteps("tempo", 0, 60)[1].name).toBe("12 min at tempo effort, comfortably hard");
  });
});
