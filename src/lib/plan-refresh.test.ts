import { describe, expect, it } from "vitest";
import { PROFILES } from "@/test/profiles";
import { addDays } from "./dates";
import { buildPlanOutline, PLAN_VERSION, type PlanOutline } from "./plan-outline";
import { coachingUpdateNote, isOutdated, rebuildOutline, rebuildStart } from "./plan-rebuild";

// Refreshing saved plans when the coaching changes (SPEC decision 79).

const input = { ...PROFILES["half marathon, intermediate"], liftsPerWeek: 3 };
const current = buildPlanOutline(input);
/** A plan saved before versions: no version, and upper/lower/full gym days. */
const old: PlanOutline = {
  ...current,
  version: undefined,
  weeks: current.weeks.map((w) => ({ ...w, strength: w.strength.map((s, i) => ({ ...s, focus: (["upper", "lower", "full"] as const)[i % 3] })) })),
};

describe("plan versions", () => {
  it("are stamped on new and rebuilt plans", () => {
    expect(current.version).toBe(PLAN_VERSION);
    const start = current.weeks[2].weekStart;
    expect(rebuildOutline(old, { ...input, startDate: start }, start).version).toBe(PLAN_VERSION);
  });

  it("mark plans from before the current coaching as outdated", () => {
    expect(isOutdated(old)).toBe(true);
    expect(isOutdated({ ...current, version: PLAN_VERSION - 1 })).toBe(true);
    expect(isOutdated(current)).toBe(false);
  });
});

describe("refreshing an old plan", () => {
  const today = addDays(current.weeks[1].weekStart, 2);
  const start = rebuildStart(today, input.startDate);
  const refreshed = rebuildOutline(old, { ...input, startDate: start }, start);

  it("starts next Monday and keeps this week and earlier exactly as they were", () => {
    expect(start).toBe(current.weeks[2].weekStart);
    expect(refreshed.weeks.slice(0, 2)).toEqual(old.weeks.slice(0, 2));
  });

  it("uses the current coaching from next Monday, with the athlete's own settings", () => {
    const after = refreshed.weeks.slice(2);
    expect(after.flatMap((w) => w.strength.map((s) => s.focus))).not.toContain("full");
    expect(after[0].strength.map((s) => s.focus)).toEqual(["push", "pull", "lower"]);
  });

  it("carries on the week numbers and the race date", () => {
    expect(refreshed.weeks.map((w) => w.weekNumber)).toEqual(refreshed.weeks.map((_, i) => i + 1));
    expect(refreshed.weeks.at(-1)!.weekStart).toBe(current.weeks.at(-1)!.weekStart);
  });
});

describe("the note on Today", () => {
  const outline = { ...current, refreshedFrom: "2026-11-02" };

  it("explains the change before it starts and through its first week", () => {
    expect(coachingUpdateNote(outline, "2026-10-29")).toMatch(/From Monday.*This week stays as it is/);
    expect(coachingUpdateNote(outline, "2026-11-02")).toMatch(/now follows ede.'s updated coaching/);
    expect(coachingUpdateNote(outline, "2026-11-08")).toMatch(/now follows/);
  });

  it("goes away after the first week, and never shows for a plan that wasn't refreshed", () => {
    expect(coachingUpdateNote(outline, "2026-11-09")).toBeNull();
    expect(coachingUpdateNote(current, "2026-10-29")).toBeNull();
  });
});
