import { describe, expect, it } from "vitest";
import type { PlannedSession, WeekPlan } from "./domain";
import { applyMove, moveTargets, planMove } from "./move";

const run = (date: string, title: string, intensity: "easy" | "hard" = "easy", slot: 1 | 2 = 1): PlannedSession => ({
  date, slot, type: "run", title, intensity, plannedMinutes: 40, isKeySession: false, steps: [{ name: "Run", minutes: 40, targetRpe: 3 }],
});
const lift = (date: string, title: string, slot: 1 | 2 = 1): PlannedSession => ({
  date, slot, type: "strength", title, intensity: "hard", plannedMinutes: 50, isKeySession: false, bodyFocus: "upper", exercises: [],
});

// Mon 12 Oct rest, Tue run, Wed lift, Thu run + lift, Fri rest, Sat long run, Sun rest.
const week: WeekPlan = {
  weekStart: "2026-10-12",
  weekNumber: 1,
  phase: "base",
  coachNote: "",
  dayNotes: { "2026-10-15": "Run first, then lift at least 6 hours later." },
  sessions: [
    run("2026-10-13", "Easy run"),
    lift("2026-10-14", "Upper body"),
    run("2026-10-15", "Tempo run", "hard"),
    lift("2026-10-15", "Lower body", 2),
    run("2026-10-17", "Long run"),
  ],
};
const none = () => false;

describe("moving sessions", () => {
  it("offers today onwards, never the past, its own day or a full day", () => {
    const targets = moveTargets(week, { date: "2026-10-14", slot: 1 }, "2026-10-13", none);
    expect(targets.map((t) => [t.dayName.slice(0, 3), t.modes.join("/")])).toEqual([
      ["Mon", ""], // past
      ["Tue", "swap/both"],
      ["Wed", ""], // its own day
      ["Thu", ""], // already two sessions
      ["Fri", "move"],
      ["Sat", "swap/both"],
      ["Sun", "move"],
    ]);
  });

  it("won't swap with a session that's done or started", () => {
    const targets = moveTargets(week, { date: "2026-10-14", slot: 1 }, "2026-10-13", (s) => s.title === "Easy run");
    expect(targets[1].modes).toEqual(["both"]);
  });

  it("moves to an empty day", () => {
    const moved = applyMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-16", "move");
    expect(moved.sessions.find((s) => s.title === "Upper body")).toMatchObject({ date: "2026-10-16", slot: 1 });
    expect(moved.sessions).toHaveLength(5);
  });

  it("swaps two sessions' days", () => {
    const moved = applyMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-17", "swap");
    expect(moved.sessions.find((s) => s.title === "Upper body")?.date).toBe("2026-10-17");
    expect(moved.sessions.find((s) => s.title === "Long run")?.date).toBe("2026-10-14");
  });

  it("does both on one day, run first, with the run-then-lift note", () => {
    const moved = applyMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-13", "both");
    const tue = moved.sessions.filter((s) => s.date === "2026-10-13");
    expect(tue.map((s) => [s.title, s.slot])).toEqual([["Easy run", 1], ["Upper body", 2]]);
    expect(moved.dayNotes["2026-10-13"]).toMatch(/Run first/);
  });

  it("drops a note that no longer applies and renumbers what's left", () => {
    const moved = applyMove(week, { date: "2026-10-15", slot: 2 }, "2026-10-16", "move");
    expect(moved.dayNotes["2026-10-15"]).toBeUndefined();
    expect(moved.sessions.find((s) => s.title === "Tempo run")?.slot).toBe(1);
  });

  it("refuses impossible moves", () => {
    expect(() => applyMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-15", "both")).toThrow(/at most two/);
    expect(() => applyMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-13", "move")).toThrow(/already has/);
  });

  it("reports every session whose day or slot changed", () => {
    expect(planMove(week, { date: "2026-10-14", slot: 1 }, "2026-10-17", "swap").changes).toEqual([
      { from: { date: "2026-10-17", slot: 1 }, to: { date: "2026-10-14", slot: 1 } },
      { from: { date: "2026-10-14", slot: 1 }, to: { date: "2026-10-17", slot: 1 } },
    ]);
    // Moving Thursday's second session away leaves the run where it was.
    expect(planMove(week, { date: "2026-10-15", slot: 2 }, "2026-10-16", "move").changes).toEqual([
      { from: { date: "2026-10-15", slot: 2 }, to: { date: "2026-10-16", slot: 1 } },
    ]);
  });
});
