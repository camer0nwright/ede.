import { describe, expect, it } from "vitest";
import { Availability, type PlannedSession, type WeekPlan } from "@/lib/domain";
import { applyMove } from "@/lib/move";
import { moveWarnings } from "./move-warnings";

const run = (date: string, title: string, intensity: "easy" | "hard", minutes = 40): PlannedSession => ({
  date, slot: 1, type: "run", title, intensity, plannedMinutes: minutes, isKeySession: intensity === "hard",
  steps: [{ name: "Run", minutes, targetRpe: intensity === "hard" ? 7 : 3 }],
});
const legs = (date: string): PlannedSession => ({
  date, slot: 1, type: "strength", title: "Lower body", intensity: "hard", plannedMinutes: 50, isKeySession: false, bodyFocus: "lower",
  exercises: [{ name: "Back squat", warmupSets: 2, workingSets: 3, reps: "5", targetRpe: 8.5, failureAllowed: false }],
});

const open = { minutes: 90, isDouble: false, secondMinutes: null };
const rest = { minutes: null, isDouble: false, secondMinutes: null };
// Mon-Sat train, Sun rest.
const availability = Availability.parse([open, open, open, open, open, open, rest]);
const ctx = { availability, history: [] };

// Tue tempo (hard), Thu easy, Fri lower body, Sat long run.
const week: WeekPlan = {
  weekStart: "2026-10-12", weekNumber: 1, phase: "build", coachNote: "", dayNotes: {},
  sessions: [run("2026-10-13", "Tempo run", "hard"), run("2026-10-15", "Easy run", "easy"), legs("2026-10-16"), run("2026-10-17", "Long run", "easy", 80)],
};

describe("move warnings", () => {
  it("says nothing for a harmless move", () => {
    expect(moveWarnings(week, applyMove(week, { date: "2026-10-15", slot: 1 }, "2026-10-14", "move"), ctx)).toEqual([]);
  });

  it("explains back-to-back hard runs in plain words", () => {
    const hardThursday = { ...week, sessions: week.sessions.map((s) => (s.title === "Easy run" ? run(s.date, "Intervals", "hard") : s)) };
    const warnings = moveWarnings(hardThursday, applyMove(hardThursday, { date: "2026-10-15", slot: 1 }, "2026-10-14", "move"), ctx);
    expect(warnings).toEqual(["This puts two hard runs on back-to-back days. A recovery day in between helps you get more from both."]);
  });

  it("warns about heavy legs the day before the long run, and about a usual rest day", () => {
    const toSunday = moveWarnings(week, applyMove(week, { date: "2026-10-17", slot: 1 }, "2026-10-18", "move"), ctx);
    expect(toSunday).toContain("Sunday is usually a rest day for you.");
    // The long run already follows Friday's legs, so that isn't repeated as new.
    expect(toSunday.some((w) => w.includes("Heavy leg work"))).toBe(false);
  });

  it("warns when a move leaves no rest day", () => {
    const sevenDays = Availability.parse([open, open, open, open, open, open, open]);
    // Monday to Saturday all have something, with an upper-body lift doubled up on Thursday.
    const upper: PlannedSession = {
      date: "2026-10-15", slot: 2, type: "strength", title: "Upper body", intensity: "hard", plannedMinutes: 40, isKeySession: false, bodyFocus: "upper", exercises: [],
    };
    const full = { ...week, sessions: [...week.sessions, run("2026-10-12", "Easy run 2", "easy"), run("2026-10-14", "Easy run 3", "easy"), upper] };
    const warnings = moveWarnings(full, applyMove(full, { date: "2026-10-15", slot: 2 }, "2026-10-18", "move"), { availability: sevenDays, history: [] });
    expect(warnings[0]).toMatch(/no full rest day/);
  });
});
