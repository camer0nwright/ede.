import { describe, expect, it } from "vitest";
import { ALL_RULES, runMinutes, totalMinutes, type PastWeek } from "@/server/plan-checker/rules";
import { PROFILES } from "@/test/profiles";
import { buildPlanOutline } from "./plan-outline";
import { continuityFrom, continuityFromWeeks, mondayOf, rebuildOutline, rebuildStart, returnFromInjury } from "./plan-rebuild";
import { RUN_LIBRARY } from "./session-library";
import { equipmentFromAnswers } from "./strength-builder";
import { buildPlanWeeks } from "./week-builder";

const input = PROFILES["half marathon, intermediate"]; // starts Monday 2026-10-12
const old = buildPlanOutline(input);

describe("plan rebuild", () => {
  it("starts next Monday, or at the plan's own start if it hasn't begun", () => {
    expect(mondayOf("2026-10-15")).toBe("2026-10-12");
    expect(rebuildStart("2026-10-15", "2026-10-12")).toBe("2026-10-19");
    expect(rebuildStart("2026-10-19", "2026-10-12")).toBe("2026-10-26"); // a Monday: this week stays
    expect(rebuildStart("2026-10-08", "2026-10-12")).toBe("2026-10-12");
  });

  it("keeps the weeks up to this one and numbers the new plan on from them", () => {
    const rebuilt = rebuildOutline(old, { ...input, runsPerWeek: 3, liftsPerWeek: 3 }, "2026-11-02");
    expect(rebuilt.weeks.slice(0, 3)).toEqual(old.weeks.slice(0, 3));
    expect(rebuilt.weeks[3].weekStart).toBe("2026-11-02");
    expect(rebuilt.weeks.map((w) => w.weekNumber)).toEqual(rebuilt.weeks.map((_, i) => i + 1));
    expect(rebuilt.weeks.at(-1)!.phase).toBe("taper"); // still builds to the same race
    // The chosen 3 lifts, except near the race where one becomes a run.
    expect(rebuilt.weeks.slice(3).every((w) => w.strength.length === 3 || (w.strength.length === 2 && (w.phase === "build" || w.phase === "peak")))).toBe(true);
  });

  it("continues block numbering so main lifts don't change mid-block", () => {
    const rebuilt = rebuildOutline(old, input, "2026-11-02");
    expect(rebuilt.weeks[3].block).toBeGreaterThanOrEqual(rebuilt.weeks[2].block);
  });

  it("carries on from this week's running and long run", () => {
    const built = buildPlanWeeks(old, { availability: input.availability, ultra: false, strengthVolume: input.strengthVolume, experienceLevel: input.experienceLevel, equipment: equipmentFromAnswers(["Full gym"]) });
    const c = continuityFrom(built[2].week);
    expect(c.lastWeekRunMinutes).toBe(built[2].week.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0));
    expect(c.longestRecentRunMinutes).toBeGreaterThan(0);
    expect(continuityFrom(undefined)).toEqual({});
  });

  it("brings you back gently after an injury: the longer you were out, the lower the load", () => {
    const before = { lastWeekRunMinutes: 200, longestRecentRunMinutes: 90 };
    expect(returnFromInjury(before, 1, true)).toEqual({ lastWeekRunMinutes: 160, longestRecentRunMinutes: 72 });
    expect(returnFromInjury(before, 1, false).lastWeekRunMinutes).toBe(140);
    expect(returnFromInjury(before, 3, false).lastWeekRunMinutes).toBe(100);
    expect(returnFromInjury(before, 10, false).lastWeekRunMinutes).toBe(60);
  });

  it("passes every plan checker rule across the seam between the old and new plan", () => {
    const build = { availability: input.availability, ultra: false, strengthVolume: input.strengthVolume, experienceLevel: input.experienceLevel, equipment: equipmentFromAnswers(["Full gym"]) };
    for (const keep of [1, 2, 3, 5, 6, 9]) {
      const oldWeeks = buildPlanWeeks(old, build);
      const start = old.weeks[keep].weekStart;
      const rebuilt = rebuildOutline(old, { ...input, ...continuityFromWeeks(oldWeeks.slice(0, keep).map((b) => b.week)), runsPerWeek: 3, liftsPerWeek: 3 }, start);
      const weeks = buildPlanWeeks(rebuilt, build);
      const history: PastWeek[] = [];
      weeks.forEach(({ week }, i) => {
        const violations = ALL_RULES.flatMap((r) => r(week, { availability: input.availability, history: [...history], lastWeekRunMinutes: input.lastWeekRunMinutes, targetDate: input.targetDate, experienceLevel: input.experienceLevel, strengthVolume: input.strengthVolume }));
        if (i >= keep) expect(violations.map((v) => v.message), `kept ${keep}, week ${i + 1}`).toEqual([]);
        const quality = week.sessions.flatMap((s) => (s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality" ? [{ kind: s.kind, level: s.level ?? 1 }] : []));
        history.push({ totalMinutes: totalMinutes(week), runMinutes: runMinutes(week), phase: week.phase, ...(quality.length > 0 && { quality }) });
      });
    }
  });
});
