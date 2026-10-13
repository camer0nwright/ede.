import { describe, expect, it } from "vitest";
import { runMinutes } from "@/server/plan-checker/rules";
import { build, equipment, injuredPlan } from "@/test/injured-plan";
import { PROFILES } from "@/test/profiles";
import { addDays } from "./dates";
import { isHeavyLowerBody, mayBeLowerBody, type Injury } from "./domain";
import { findExercise } from "./exercise-library";
import { adaptWeekForInjury, adaptWeeksForInjury, bandSummary, injuryBand } from "./injury";
import { buildPlanOutline } from "./plan-outline";
import { buildPlanWeeks } from "./week-builder";

const INJURIES: Record<string, Injury> = {
  "mild knee": { area: "knee", painLevel: 2, painWhen: "running" },
  "moderate ankle": { area: "ankle", painLevel: 5, painWhen: "running" },
  "moderate hip, hurts walking": { area: "hip", painLevel: 3, painWhen: "walking" },
  "severe knee": { area: "knee", painLevel: 8, painWhen: "running" },
  "mild shoulder": { area: "shoulder", painLevel: 3, painWhen: "lifting_only" },
  "severe back": { area: "back", painLevel: 5, painWhen: "resting" },
};

describe("injury bands", () => {
  it("sorts pain into mild, moderate and severe", () => {
    expect(injuryBand(INJURIES["mild knee"])).toBe("mild");
    expect(injuryBand(INJURIES["moderate hip, hurts walking"])).toBe("moderate");
    expect(injuryBand(INJURIES["severe back"])).toBe("severe");
    expect(bandSummary(INJURIES["moderate ankle"])).toMatch(/Running is paused/);
  });
});

describe.each(Object.entries(PROFILES))("injury adaptation: %s", (_name, input) => {
  it.each(Object.entries(INJURIES))("%s: passes every plan checker rule, injured and coming back", (_injury, injury) => {
    const weeksOut = 3;
    const fromWeek = 1;
    const weeks = injuredPlan(input, injury, fromWeek, weeksOut);
    weeks.forEach(({ week, violations }, i) => {
      // Week 1 is the plan as built (tested elsewhere); the injury starts in week 2.
      if (i >= fromWeek) expect(violations.map((v) => `${v.rule}: ${v.message}`), `week ${week.weekNumber}`).toEqual([]);
    });
    expect(weeks.filter((w) => w.injured)).toHaveLength(Math.min(weeksOut, weeks.length - fromWeek));
  });
});

describe("adapting a week", () => {
  const input = PROFILES["half marathon, intermediate"];
  const outline = buildPlanOutline(input);
  const weeks = buildPlanWeeks(outline, build(input)).map((b) => b.week);
  const week = weeks[2];
  const strength = { volume: input.strengthVolume, equipment, block: outline.weeks[2].block };
  const lastWeek = runMinutes(weeks[1]);

  it("mild pain: easy, flat runs, cut by at least 20%", () => {
    const w = adaptWeekForInjury(week, { injury: INJURIES["mild knee"], from: week.weekStart, beforeRunMinutes: lastWeek, strength });
    const runs = w.sessions.filter((s) => s.type === "run");
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((r) => r.intensity === "easy" && r.kind !== "long_hilly")).toBe(true);
    expect(runMinutes(w)).toBeLessThanOrEqual(lastWeek * 0.8);
    expect(w.coachNote).toMatch(/knee/);
  });

  it("mild pain after time off: running comes back below the week before the injury, not stuck at zero", () => {
    const off = { ...week, sessions: week.sessions.filter((x) => x.type !== "run") };
    const adapted = adaptWeeksForInjury([weeks[1], off, week], { injury: INJURIES["mild knee"], since: off.weekStart, lastWeekRunMinutes: input.lastWeekRunMinutes, blocks: [1, 1, 1], volume: input.strengthVolume, equipment, experienceLevel: input.experienceLevel });
    expect(runMinutes(adapted[2].week)).toBeGreaterThan(0);
    expect(runMinutes(adapted[2].week)).toBeLessThanOrEqual(lastWeek * 0.8);
  });

  it("moderate pain: no running, a physio or doctor in the note, lifts avoid the area", () => {
    const w = adaptWeekForInjury(week, { injury: INJURIES["moderate ankle"], from: week.weekStart, beforeRunMinutes: lastWeek, strength });
    expect(w.sessions.some((s) => s.type === "run")).toBe(false);
    expect(w.sessions.filter((s) => s.type === "strength")).toHaveLength(week.sessions.filter((s) => s.type === "strength").length);
    expect(w.coachNote).toMatch(/physio or doctor/);
    for (const s of w.sessions) if (s.type === "strength") for (const e of s.exercises) expect(findExercise(e.name)?.loads ?? []).not.toContain("ankle");
  });

  it("severe pain: upper body only, and see a doctor", () => {
    const w = adaptWeekForInjury(week, { injury: INJURIES["severe knee"], from: week.weekStart, beforeRunMinutes: lastWeek, strength });
    expect(w.sessions.every((s) => s.type === "strength" && s.bodyFocus === "upper")).toBe(true);
    for (const s of w.sessions) if (s.type === "strength") expect(isHeavyLowerBody(s) || s.exercises.some((e) => mayBeLowerBody(e.name))).toBe(false);
    expect(w.coachNote).toMatch(/doctor/);
  });

  it("reported mid-week: earlier sessions stay as they were", () => {
    const from = addDays(week.weekStart, 3);
    const w = adaptWeekForInjury(week, { injury: INJURIES["moderate ankle"], from, beforeRunMinutes: lastWeek, strength });
    expect(w.sessions.filter((s) => s.date < from)).toEqual(week.sessions.filter((s) => s.date < from));
    expect(w.sessions.some((s) => s.type === "run" && s.date >= from)).toBe(false);
  });

  it("only changes weeks from the day it was reported", () => {
    const since = addDays(weeks[3].weekStart, 2);
    const adapted = adaptWeeksForInjury(weeks, { injury: INJURIES["moderate ankle"], since, lastWeekRunMinutes: input.lastWeekRunMinutes, blocks: outline.weeks.map((w) => w.block), volume: input.strengthVolume, equipment, experienceLevel: input.experienceLevel });
    expect(adapted.slice(0, 3).map((a) => a.week)).toEqual(weeks.slice(0, 3));
    expect(adapted.slice(0, 3).every((a) => !a.injured)).toBe(true);
    expect(adapted.slice(3).every((a) => a.injured)).toBe(true);
  });
});
