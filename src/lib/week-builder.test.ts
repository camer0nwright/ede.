import { describe, expect, it } from "vitest";
import { ALL_RULES, runMinutes, totalMinutes, type CheckContext, type PastWeek } from "@/server/plan-checker/rules";
import { PROFILES } from "@/test/profiles";
import { isHeavyLowerBody, type WeekPlan } from "./domain";
import { findExercise } from "./exercise-library";
import { buildPlanOutline, type OutlineInput } from "./plan-outline";
import { RUN_LIBRARY } from "./session-library";
import { equipmentFromAnswers } from "./strength-builder";
import { buildPlanWeeks } from "./week-builder";

// The end-to-end test: every week of every test athlete's plan is placed on
// days, filled in with steps and exercises, then judged by the full plan
// checker with the history carried forward week by week, as the app will.

function buildAll(input: OutlineInput) {
  const outline = buildPlanOutline(input);
  const ultra = input.raceDistance === "ultra";
  const builtWeeks = buildPlanWeeks(outline, {
    availability: input.availability,
    ultra,
    strengthVolume: input.strengthVolume,
    experienceLevel: input.experienceLevel,
    equipment: equipmentFromAnswers(["Full gym"]),
  });
  const history: PastWeek[] = [];
  return outline.weeks.map((o, i) => {
    const built = builtWeeks[i];
    const ctx: CheckContext = {
      availability: input.availability,
      history: [...history],
      lastWeekRunMinutes: input.lastWeekRunMinutes,
      targetDate: input.targetDate,
      experienceLevel: input.experienceLevel,
      strengthVolume: input.strengthVolume,
      ...(ultra && { ultraDistanceKm: input.ultraDistanceKm }),
    };
    const violations = ALL_RULES.flatMap((rule) => rule(built.week, ctx));
    history.push(pastWeek(built.week));
    return { o, built, violations };
  });
}

function pastWeek(w: WeekPlan): PastWeek {
  const quality = w.sessions.flatMap((s) => (s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality" ? [{ kind: s.kind, level: s.level ?? 1 }] : []));
  return { totalMinutes: totalMinutes(w), runMinutes: runMinutes(w), phase: w.phase, ...(quality.length > 0 && { quality }) };
}

describe.each(Object.entries(PROFILES))("built weeks: %s", (_name, input) => {
  const weeks = buildAll(input);

  it("places every session on a day", () => {
    for (const { o, built } of weeks) {
      expect(built.placed, `week ${o.weekNumber}`).toBe(true);
      expect(built.week.sessions.filter((s) => s.type === "run")).toHaveLength(o.runs.length);
      expect(built.week.sessions.filter((s) => s.type === "strength")).toHaveLength(o.strength.length);
    }
  });

  it("passes every plan checker rule, every week", () => {
    for (const { o, violations } of weeks) {
      expect(violations.map((v) => `[${v.rule}] ${v.message}`), `week ${o.weekNumber}`).toEqual([]);
    }
  });

  it("puts the long run at the weekend when the weekend has the time", () => {
    const weekendTime = Math.max(input.availability[5].minutes ?? 0, input.availability[6].minutes ?? 0);
    const weekdayTime = Math.max(...input.availability.slice(0, 5).map((d) => d.minutes ?? 0));
    if (weekendTime < weekdayTime) return;
    for (const { o, built } of weeks) {
      const long = built.week.sessions.find((s) => s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "long" && s.title !== "Back-to-back long run");
      if (!long) continue;
      const day = (new Date(`${long.date}T00:00:00Z`).getUTCDay() + 6) % 7;
      expect(day, `week ${o.weekNumber}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("lists real exercises from the library in every gym session", () => {
    for (const { o, built } of weeks) {
      for (const s of built.week.sessions) {
        if (s.type !== "strength") continue;
        // Light weeks may be trimmed to a single exercise to fit their lower load.
        expect(s.exercises.length).toBeGreaterThanOrEqual(o.phase === "recovery" || o.phase === "taper" ? 1 : 2);
        for (const e of s.exercises) expect(findExercise(e.name), e.name).toBeDefined();
      }
    }
  });

  it("notes run-first on double days with a hard or long run", () => {
    for (const { built } of weeks) {
      for (const s of built.week.sessions) {
        if (s.type !== "strength" || s.slot !== 2) continue;
        const run = built.week.sessions.find((r) => r.type === "run" && r.date === s.date);
        if (run && (run.intensity === "hard" || run.isKeySession && run.plannedMinutes >= 60)) {
          expect(built.week.dayNotes[s.date]).toMatch(/Run first/);
        }
      }
    }
  });

  it("never puts heavy legs on consecutive days", () => {
    for (const { o, built } of weeks) {
      const heavy = built.week.sessions.filter(isHeavyLowerBody).map((s) => s.date).sort();
      for (let i = 1; i < heavy.length; i++) expect(heavy[i], `week ${o.weekNumber}`).not.toBe(heavy[i - 1]);
    }
  });
});
