import { describe, expect, it } from "vitest";
import { demoAvailability, demoWeek } from "@/lib/demo-week";
import type { Availability, PlannedSession, WeekPlan } from "@/lib/domain";
import { checkWeekPlan, describeViolations } from "./index";
import {
  doubleDay,
  easyRunning,
  fitsAvailability,
  heavyLegsBeforeKeyRun,
  loadProgression,
  recalcCap,
  recoveryWeek,
  restDay,
  taper,
  totalMinutes,
  weekStructure,
  type CheckContext,
  type PastWeek,
} from "./rules";

// The demo week (310 min, 2026-10-12 to 2026-10-18) passes every rule.
// Mon rest; Tue easy run + lower body; Wed easy run; Thu intervals (key);
// Fri recovery run + upper body; Sat long run (key); Sun rest.
// Each test changes one thing about it and checks the right rule catches it.
const ctx: CheckContext = { availability: demoAvailability, history: [] };

function week(changes: Partial<WeekPlan> = {}): WeekPlan {
  return { ...structuredClone(demoWeek), ...changes };
}

/** Changes the session on `date` in `slot`. */
function edit(date: string, slot: number, patch: Partial<PlannedSession>): WeekPlan {
  const w = week();
  w.sessions = w.sessions.map((s) =>
    s.date === date && s.slot === slot ? ({ ...s, ...patch } as PlannedSession) : s,
  );
  return w;
}

function add(...sessions: PlannedSession[]): WeekPlan {
  const w = week();
  w.sessions.push(...sessions);
  return w;
}

const easyRun = (date: string, minutes: number, slot: 1 | 2 = 1): PlannedSession => ({
  date,
  slot,
  type: "run",
  title: "Easy run",
  intensity: "easy",
  plannedMinutes: minutes,
  isKeySession: false,
  steps: [],
});

const build = (totalMinutes: number): PastWeek => ({ totalMinutes, phase: "build" });
const recovery = (totalMinutes: number): PastWeek => ({ totalMinutes, phase: "recovery" });

const rulesHit = (w: unknown, c: CheckContext = ctx) =>
  checkWeekPlan(w, c).violations.map((v) => v.rule);

describe("the demo week", () => {
  it("passes every rule", () => {
    const result = checkWeekPlan(demoWeek, ctx);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(totalMinutes(demoWeek)).toBe(310);
  });
});

describe("plan format", () => {
  it("rejects malformed AI output, such as a swim session", () => {
    const raw = { ...demoWeek, sessions: [{ ...demoWeek.sessions[0], type: "swim" }] };
    const result = checkWeekPlan(raw, ctx);
    expect(result.ok).toBe(false);
    expect(result.violations[0].rule).toBe("week-structure");
    expect(result.violations[0].message).toMatch(/Invalid plan format/);
  });
});

describe("week-structure", () => {
  it("requires the week to start on a Monday", () => {
    expect(weekStructure(week({ weekStart: "2026-10-13" }), ctx)).toHaveLength(1);
  });

  it("rejects sessions outside the week", () => {
    const v = weekStructure(add(easyRun("2026-10-19", 30)), ctx);
    expect(v[0].message).toMatch(/outside the week/);
  });

  it("allows at most two sessions on a day, in different slots", () => {
    const messages = weekStructure(add(easyRun("2026-10-13", 20, 2)), ctx).map((v) => v.message);
    expect(messages.some((m) => /has 3 sessions/.test(m))).toBe(true);
    expect(weekStructure(add(easyRun("2026-10-15", 20, 1)), ctx)[0].message).toMatch(/same slot/);
  });
});

describe("rest-day", () => {
  it("passes with two rest days", () => {
    expect(restDay(week(), ctx)).toEqual([]);
  });

  it("fails when every day has a session", () => {
    const w = add(easyRun("2026-10-12", 30), easyRun("2026-10-18", 30));
    expect(restDay(w, ctx)).toHaveLength(1);
  });
});

describe("fits-availability", () => {
  it("rejects sessions on a rest day", () => {
    const v = fitsAvailability(add(easyRun("2026-10-12", 30)), ctx);
    expect(v[0].message).toMatch(/rest day/);
  });

  it("rejects a session longer than the time available", () => {
    const v = fitsAvailability(edit("2026-10-15", 1, { plannedMinutes: 50 }), ctx);
    expect(v[0].message).toMatch(/50 min but only 45 min/);
  });

  it("checks the second slot against the second time on a double day", () => {
    const v = fitsAvailability(edit("2026-10-13", 2, { plannedMinutes: 50 }), ctx);
    expect(v[0].message).toMatch(/only 45 min/);
  });

  it("rejects two sessions on a day that is not a double day", () => {
    const v = fitsAvailability(add(easyRun("2026-10-15", 20, 2)), ctx);
    expect(v.map((x) => x.message).join()).toMatch(/not a double day/);
  });

  it("rejects the second slot on its own on a normal day", () => {
    const w = week();
    w.sessions = w.sessions.map((s) => (s.date === "2026-10-14" ? { ...s, slot: 2 } : s));
    expect(fitsAvailability(w, ctx)[0].message).toMatch(/only double days/);
  });

  it("treats 120 minutes as 120+ with no upper limit", () => {
    const availability: Availability = demoAvailability.map((d, i) =>
      i === 5 ? { ...d, minutes: 120 } : d,
    );
    const w = edit("2026-10-17", 1, { plannedMinutes: 150 });
    expect(fitsAvailability(w, { ...ctx, availability })).toEqual([]);
  });
});

describe("double-day", () => {
  it("passes an easy run plus a lift", () => {
    expect(doubleDay(week(), ctx)).toEqual([]);
  });

  it("rejects two runs on a double day", () => {
    const w = week();
    w.sessions = w.sessions.filter((s) => !(s.date === "2026-10-13" && s.slot === 2));
    w.sessions.push(easyRun("2026-10-13", 30, 2));
    expect(doubleDay(w, ctx)[0].message).toMatch(/one run and one strength/);
  });

  it("rejects two hard sessions", () => {
    const v = doubleDay(edit("2026-10-13", 1, { intensity: "hard" }), ctx);
    expect(v[0].message).toMatch(/two hard sessions/);
  });

  it("rejects heavy legs alongside a key run", () => {
    const v = doubleDay(edit("2026-10-13", 1, { isKeySession: true }), ctx);
    expect(v[0].message).toMatch(/key run with heavy legs/);
  });
});

describe("heavy-legs-before-key-run", () => {
  it("passes when heavy legs is two days before the key run", () => {
    expect(heavyLegsBeforeKeyRun(week(), ctx)).toEqual([]);
  });

  it("fails when heavy legs is the day before a key run", () => {
    const w = edit("2026-10-16", 2, { bodyFocus: "lower" } as Partial<PlannedSession>);
    const v = heavyLegsBeforeKeyRun(w, ctx);
    expect(v).toHaveLength(1);
    expect(v[0].date).toBe("2026-10-16");
  });
});

describe("easy-running (at least 80%)", () => {
  it("passes the demo week at 80% easy", () => {
    expect(easyRunning(week(), ctx)).toEqual([]);
  });

  it("fails when too much running is not easy", () => {
    const v = easyRunning(edit("2026-10-14", 1, { intensity: "moderate" }), ctx);
    expect(v[0].message).toMatch(/Only 63%/);
  });

  it("passes at exactly 80%", () => {
    const w = week({
      sessions: [
        easyRun("2026-10-13", 80),
        { ...easyRun("2026-10-15", 20), intensity: "hard" },
      ],
    });
    expect(easyRunning(w, ctx)).toEqual([]);
  });

  it("ignores weeks with no running", () => {
    expect(easyRunning(week({ sessions: [] }), ctx)).toEqual([]);
  });
});

describe("load-progression", () => {
  it("skips week 1, which has nothing to compare against", () => {
    expect(loadProgression(week(), ctx)).toEqual([]);
  });

  it("allows up to 10% more than the last build week", () => {
    expect(loadProgression(week(), { ...ctx, history: [build(290)] })).toEqual([]);
  });

  it("fails a jump of more than 10%", () => {
    const v = loadProgression(week(), { ...ctx, history: [build(250)] });
    expect(v[0].message).toMatch(/at most 275 min/);
  });

  it("allows at least 20 extra minutes for low-volume athletes", () => {
    const w = week({ sessions: [easyRun("2026-10-13", 60), easyRun("2026-10-15", 60)] });
    expect(loadProgression(w, { ...ctx, history: [build(100)] })).toEqual([]);
  });

  it("compares to the last build week, not a recovery week", () => {
    expect(loadProgression(week(), { ...ctx, history: [build(290), recovery(200)] })).toEqual([]);
  });
});

describe("recovery-week", () => {
  it("requires a recovery week after 3 build weeks in a row", () => {
    const v = recoveryWeek(week(), { ...ctx, history: [build(280), build(290), build(300)] });
    expect(v[0].message).toMatch(/must be a recovery week/);
  });

  it("rejects a recovery week that comes too soon", () => {
    const v = recoveryWeek(week({ phase: "recovery" }), { ...ctx, history: [build(500)] });
    expect(v[0].message).toMatch(/too soon/);
  });

  it("passes a lighter recovery week after 2-3 build weeks", () => {
    const c = { ...ctx, history: [build(420), build(450)] };
    expect(recoveryWeek(week({ phase: "recovery" }), c)).toEqual([]);
  });

  it("rejects a recovery week that is not lighter", () => {
    const c = { ...ctx, history: [build(300), build(320)] };
    const v = recoveryWeek(week({ phase: "recovery" }), c);
    expect(v[0].message).toMatch(/at most 256 min/);
  });
});

describe("taper", () => {
  const raceSunday = "2026-10-18";
  const nextSunday = "2026-10-25";

  it("requires race week to be a taper week", () => {
    const v = taper(week(), { ...ctx, targetDate: raceSunday });
    expect(v[0].message).toMatch(/must be a taper week/);
  });

  it("caps race week at 60% of the last full week", () => {
    const pass = { ...ctx, targetDate: raceSunday, history: [build(600)] };
    expect(taper(week({ phase: "taper" }), pass)).toEqual([]);
    const fail = { ...ctx, targetDate: raceSunday, history: [build(450)] };
    expect(taper(week({ phase: "taper" }), fail)[0].message).toMatch(/at most 270 min/);
  });

  it("caps the week before race week at 80%", () => {
    const fail = { ...ctx, targetDate: nextSunday, history: [build(350)] };
    expect(taper(week({ phase: "taper" }), fail)[0].message).toMatch(/at most 280 min/);
  });

  it("rejects a taper week outside the taper", () => {
    expect(taper(week({ phase: "taper" }), ctx)).toHaveLength(1);
  });

  it("turns off progression and recovery rules during the taper", () => {
    const c = {
      ...ctx,
      targetDate: raceSunday,
      history: [build(560), build(570), build(580)],
    };
    expect(rulesHit(week({ phase: "taper" }), c)).toEqual([]);
  });
});

describe("recalc-cap", () => {
  const c = { ...ctx, previousVersion: demoWeek };

  it("always allows removing or easing sessions", () => {
    const w = week({ sessions: demoWeek.sessions.slice(0, 3) });
    expect(recalcCap(w, c)).toEqual([]);
  });

  it("allows up to 3 sessions to be added or made harder", () => {
    const w = week();
    w.sessions = w.sessions.map((s, i) => (i < 3 ? { ...s, plannedMinutes: s.plannedMinutes + 1 } : s));
    expect(recalcCap(w, c)).toEqual([]);
  });

  it("rejects more than 3 sessions added or made harder", () => {
    const w = week();
    w.sessions = w.sessions.map((s, i) => (i < 4 ? { ...s, plannedMinutes: s.plannedMinutes + 1 } : s));
    expect(recalcCap(w, c)[0].message).toMatch(/4 sessions/);
  });

  it("rejects growing the week by more than 10% (no cramming)", () => {
    const w = edit("2026-10-17", 1, { plannedMinutes: 120 });
    expect(recalcCap(w, c)[0].message).toMatch(/Do not cram/);
  });
});

describe("describeViolations", () => {
  it("lists every problem for the AI to fix in one retry", () => {
    const w = add(easyRun("2026-10-12", 30), easyRun("2026-10-18", 30));
    const result = checkWeekPlan(w, ctx);
    expect(result.ok).toBe(false);
    const text = describeViolations(result.violations);
    expect(text).toMatch(/\[rest-day\]/);
    expect(text).toMatch(/\[fits-availability\]/);
  });
});
