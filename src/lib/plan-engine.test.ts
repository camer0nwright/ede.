import { describe, expect, it } from "vitest";
import { demoAvailability, demoEngineWeek, demoWeek } from "./demo-week";
import { DAY_NAMES, isHeavyLowerBody, type PlannedSession } from "./domain";
import { EngineWeek, parseEngineResponse, toWeekPlan, weekToEngine } from "./plan-engine";
import { checkEngineResponse } from "@/server/plan-checker";

const asText = (w: unknown) => JSON.stringify(w, null, 2);
const clone = (): EngineWeek => structuredClone(demoEngineWeek);

function errorsFor(w: unknown): string {
  const r = parseEngineResponse(asText(w));
  return r.ok ? "" : r.errors.join("\n");
}

describe("parseEngineResponse", () => {
  it("accepts the demo week exactly as the prompt specifies it", () => {
    const r = parseEngineResponse(asText(demoEngineWeek));
    expect(r.ok).toBe(true);
  });

  it("accepts a reply wrapped in a ```json fence", () => {
    const r = parseEngineResponse("```json\n" + asText(demoEngineWeek) + "\n```");
    expect(r.ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    const r = parseEngineResponse("Here is your plan: {");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toMatch(/not valid JSON/);
  });

  it("rejects a session type other than run or strength", () => {
    const w = clone() as unknown as { days: { sessions: { type: string }[] }[] };
    w.days[2].sessions[0].type = "swim";
    expect(errorsFor(w)).toMatch(/days\.2\.sessions\.0\.type/);
  });

  it("requires all 7 days, Monday to Sunday, in order", () => {
    const short = clone();
    short.days = short.days.slice(0, 6);
    expect(errorsFor(short)).toMatch(/days/);

    const swapped = clone();
    [swapped.days[0], swapped.days[1]] = [swapped.days[1], swapped.days[0]];
    expect(errorsFor(swapped)).toMatch(/Day 1 must be Monday, not Tuesday/);
  });

  it("requires the run and strength fields to be used the right way round", () => {
    const runWithFocus = clone();
    runWithFocus.days[2].sessions[0].body_focus = "lower";
    expect(errorsFor(runWithFocus)).toMatch(/Runs must have body_focus null/);

    const liftWithoutFocus = clone();
    liftWithoutFocus.days[1].sessions[1].body_focus = null;
    expect(errorsFor(liftWithoutFocus)).toMatch(/Strength sessions need a body_focus/);

    const liftWithSteps = clone();
    liftWithSteps.days[1].sessions[1].steps = [
      { name: "Jog", duration_minutes: 5, target_effort_rpe: 3 },
    ];
    expect(errorsFor(liftWithSteps)).toMatch(/Strength sessions must have an empty steps array/);
  });

  it("rejects an unknown phase", () => {
    const w = { ...clone(), phase: "offseason" };
    expect(errorsFor(w)).toMatch(/phase/);
  });
});

describe("session_kind and level (optional, for variety)", () => {
  it("carries a run's library kind and level into the week", () => {
    const w = clone();
    Object.assign(w.days[3].sessions[0], { session_kind: "intervals_long", level: 3 });
    const r = parseEngineResponse(asText(w));
    expect(r.ok).toBe(true);
    const session = toWeekPlan(r.ok ? r.week : w, "2026-10-12").sessions.find((s) => s.title === "Intervals")!;
    expect(session.type === "run" && [session.kind, session.level]).toEqual(["intervals_long", 3]);
  });

  it("rejects an unknown kind, and a kind on a strength session", () => {
    const unknown = clone();
    Object.assign(unknown.days[3].sessions[0], { session_kind: "swim_intervals" });
    expect(errorsFor(unknown)).toMatch(/session_kind/);

    const onLift = clone();
    Object.assign(onLift.days[1].sessions[1], { session_kind: "tempo" });
    expect(errorsFor(onLift)).toMatch(/Only runs have a session_kind/);
  });
});

describe("toWeekPlan", () => {
  const week = toWeekPlan(demoEngineWeek, "2026-10-12");

  it("turns day names into dates from the Monday", () => {
    const dates = [...new Set(week.sessions.map((s) => s.date))];
    expect(dates).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
  });

  it("keeps the engine's order within a day as slots 1 and 2", () => {
    const tuesday = week.sessions.filter((s) => s.date === "2026-10-13");
    expect(tuesday.map((s) => [s.slot, s.type])).toEqual([
      [1, "run"],
      [2, "strength"],
    ]);
  });

  it("carries over steps, exercises and the key session marker", () => {
    const intervals = week.sessions.find((s) => s.title === "Intervals")!;
    expect(intervals.isKeySession).toBe(true);
    expect(intervals.type === "run" && intervals.steps.map((s) => s.minutes)).toEqual([12, 24, 9]);

    const lower = week.sessions.find((s) => s.title === "Lower body strength")!;
    expect(lower.type === "strength" && lower.bodyFocus).toBe("lower");
    expect(lower.type === "strength" && lower.exercises[0]).toEqual({
      name: "Back squat",
      warmupSets: 2,
      workingSets: 2,
      reps: "5",
      targetRpe: 9,
      failureAllowed: false,
    });
  });

  it("keeps week details, day notes and the coach note", () => {
    expect(week.weekNumber).toBe(1);
    expect(week.phase).toBe("base");
    expect(week.dayNotes["2026-10-15"]).toBe("Key session of the week.");
    expect(week.coachNote).toMatch(/steady base week/);
  });
});

describe("isHeavyLowerBody (SPEC decision 4)", () => {
  const lift = (bodyFocus: "upper" | "lower" | "full", rpe: number): PlannedSession => ({
    date: "2026-10-13",
    slot: 1,
    type: "strength",
    title: "Lift",
    intensity: "hard",
    plannedMinutes: 40,
    isKeySession: false,
    bodyFocus,
    exercises: [{ name: "Squat", warmupSets: 1, workingSets: 2, reps: "5", targetRpe: rpe, failureAllowed: false }],
  });

  it("counts any lower-body session", () => {
    expect(isHeavyLowerBody(lift("lower", 6))).toBe(true);
  });

  it("counts a full-body session only with an exercise at RPE 8 or more", () => {
    expect(isHeavyLowerBody(lift("full", 8))).toBe(true);
    expect(isHeavyLowerBody(lift("full", 7.5))).toBe(false);
  });

  it("never counts upper body or runs", () => {
    expect(isHeavyLowerBody(lift("upper", 10))).toBe(false);
    const run = { ...lift("upper", 10), type: "run", steps: [] } as unknown as PlannedSession;
    expect(isHeavyLowerBody(run)).toBe(false);
  });
});

describe("checkEngineResponse", () => {
  // An intermediate athlete who ran 220 minutes last week.
  const ctx = {
    availability: demoAvailability,
    history: [{ totalMinutes: 300, runMinutes: 220, phase: "build" as const }],
  };

  it("passes the demo week end to end", () => {
    const r = checkEngineResponse(asText(demoEngineWeek), "2026-10-12", ctx);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("reports a format problem as a violation the AI can fix", () => {
    const r = checkEngineResponse("not json", "2026-10-12", ctx);
    expect(r.ok).toBe(false);
    expect(r.violations[0].rule).toBe("week-structure");
  });

  it("runs the training rules on a well-formed but unsafe week", () => {
    const w = clone();
    w.days[4].sessions[1].body_focus = "lower"; // Friday legs before Saturday's key long run
    const r = checkEngineResponse(asText(w), "2026-10-12", ctx);
    expect(r.violations.map((v) => v.rule)).toContain("heavy-legs-near-key-run");
  });

  it("turns ede.'s week into the engine format and back without losing anything", () => {
    const week = demoWeek;
    const engine = weekToEngine(week);
    expect(EngineWeek.safeParse(engine).success).toBe(true);
    expect(engine.days.map((d) => d.day)).toEqual([...DAY_NAMES]);
    expect(toWeekPlan(engine, week.weekStart)).toEqual(week);
  });
});
