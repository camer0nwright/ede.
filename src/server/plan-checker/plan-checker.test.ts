import { describe, expect, it } from "vitest";
import { demoAvailability, demoWeek } from "@/lib/demo-week";
import type { Availability, PlannedSession, StrengthExercise, WeekPlan } from "@/lib/domain";
import { checkWeekPlan, describeViolations } from "./index";
import {
  beginnerEasyRunning,
  consecutiveHardRuns,
  consecutiveHeavyLegs,
  strengthEffort,
  doubleDay,
  failureAllowedRule,
  injuryBand,
  injuryRule,
  easyRunning,
  fitsAvailability,
  heavyLegsNearKeyRun,
  keyRuns,
  longRuns,
  lowerBodyAfterKeyRun,
  recalcCap,
  recoveryWeek,
  restDay,
  runMinutes,
  runProgression,
  sessionVariety,
  taper,
  totalMinutes,
  weekStructure,
  workingSets,
  type CheckContext,
  type PastWeek,
} from "./rules";

// The demo week (310 min, 230 of them running, 2026-10-12 to 2026-10-18)
// passes every rule:
//   Mon rest; Tue easy run + lower body; Wed easy run; Thu intervals (hard);
//   Fri recovery run + upper body; Sat long easy run 85 min; Sun rest.
// Each test changes one thing about it and checks the right rule catches it.

/** A past week. Run minutes default to three quarters of the total. */
const build = (total: number, run = Math.round(total * 0.75)): PastWeek => ({
  totalMinutes: total,
  runMinutes: run,
  phase: "build",
});
const recovery = (total: number, run = Math.round(total * 0.75)): PastWeek => ({
  totalMinutes: total,
  runMinutes: run,
  phase: "recovery",
});

// An intermediate athlete on low strength volume who ran 220 minutes last week.
const ctx: CheckContext = {
  availability: demoAvailability,
  history: [build(300, 220)],
  experienceLevel: "intermediate",
  strengthVolume: "low",
};

function week(changes: Partial<WeekPlan> = {}): WeekPlan {
  return { ...structuredClone(demoWeek), ...changes };
}

/** Changes the session on `date` in `slot`. */
function edit(date: string, slot: number, patch: Partial<PlannedSession>, w = week()): WeekPlan {
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

const exercise = (name: string, targetRpe: number, workingSets = 2): StrengthExercise => ({
  name,
  warmupSets: 0,
  workingSets,
  reps: "8",
  targetRpe,
  failureAllowed: false,
});

const lift = (
  date: string,
  bodyFocus: "upper" | "lower" | "full",
  exercises: StrengthExercise[],
  slot: 1 | 2 = 1,
): PlannedSession => ({
  date,
  slot,
  type: "strength",
  title: `${bodyFocus} body`,
  intensity: "hard",
  plannedMinutes: 40,
  isKeySession: false,
  bodyFocus,
  exercises,
});

const rulesHit = (w: unknown, c: CheckContext = ctx) =>
  checkWeekPlan(w, c).violations.map((v) => v.rule);

describe("the demo week", () => {
  it("passes every rule", () => {
    const result = checkWeekPlan(demoWeek, ctx);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(totalMinutes(demoWeek)).toBe(310);
    expect(runMinutes(demoWeek)).toBe(230);
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
});

describe("key runs: hard or long (SPEC decisions 3 and 5)", () => {
  const titles = (sessions: PlannedSession[]) => sessions.map((s) => s.title);

  it("finds the demo week's hard intervals and long run", () => {
    expect(titles(keyRuns(week()))).toEqual(["Intervals", "Long easy run"]);
  });

  it("only counts the longest run as long when it is 60+ minutes", () => {
    const w = edit("2026-10-17", 1, { plannedMinutes: 55 });
    expect(longRuns(w)).toEqual([]);
    expect(titles(keyRuns(w))).toEqual(["Intervals"]);
  });

  it("counts both runs of a back-to-back as long runs", () => {
    const w = add({ ...easyRun("2026-10-18", 70), title: "Back-to-back long run" });
    expect(titles(longRuns(w))).toEqual(["Long easy run", "Back-to-back long run"]);
  });

  it("does not count a 60+ minute run that isn't next to the longest run", () => {
    const w = edit("2026-10-14", 1, { plannedMinutes: 65 });
    expect(titles(longRuns(w))).toEqual(["Long easy run"]);
  });

  it("ignores the AI's own key-session marker", () => {
    const w = edit("2026-10-14", 1, { isKeySession: true });
    expect(titles(keyRuns(w))).toEqual(["Intervals", "Long easy run"]);
  });
});

describe("heavy-legs-near-key-run", () => {
  it("passes when heavy legs is two days before the next key run", () => {
    expect(heavyLegsNearKeyRun(week(), ctx)).toEqual([]);
  });

  it("fails when heavy legs is the day before a long run", () => {
    const w = edit("2026-10-16", 2, { bodyFocus: "lower" } as Partial<PlannedSession>);
    const v = heavyLegsNearKeyRun(w, ctx);
    expect(v).toHaveLength(1);
    expect(v[0].date).toBe("2026-10-16");
    expect(v[0].message).toMatch(/day before/);
  });

  it("fails when heavy legs is the same day as a hard run", () => {
    const v = heavyLegsNearKeyRun(edit("2026-10-13", 1, { intensity: "hard" }), ctx);
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/same day/);
  });

  it("allows a light full-body session (under RPE 8) the day before", () => {
    const w = week();
    w.sessions = w.sessions.filter((s) => !(s.date === "2026-10-16" && s.slot === 2));
    w.sessions.push(lift("2026-10-16", "full", [exercise("Goblet squat", 7), exercise("Push-up", 7.5)], 2));
    expect(heavyLegsNearKeyRun(w, ctx)).toEqual([]);
  });
});

describe("consecutive-hard-runs", () => {
  it("allows a hard upper-body lift the day after a hard run", () => {
    expect(consecutiveHardRuns(week(), ctx)).toEqual([]);
    expect(rulesHit(week())).toEqual([]);
  });

  it("rejects hard runs on consecutive days", () => {
    const v = consecutiveHardRuns(edit("2026-10-14", 1, { intensity: "hard" }), ctx);
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/Hard runs/);
    expect(v[0].date).toBe("2026-10-15");
  });

  it("allows strength sessions on consecutive days", () => {
    const w = add(lift("2026-10-14", "upper", [exercise("Row", 9)], 2));
    expect(consecutiveHardRuns(w, ctx)).toEqual([]);
    expect(rulesHit(w, { ...ctx, availability: demoAvailability.map((d, i) => (i === 2 ? { minutes: 45, isDouble: true, secondMinutes: 45 } : d)) })).toEqual([]);
  });
});

describe("lower-body-after-key-run", () => {
  it("passes upper body the day after a hard run", () => {
    expect(lowerBodyAfterKeyRun(week(), ctx)).toEqual([]);
  });

  it("rejects lower body above RPE 8 the day after a hard run", () => {
    const w = edit("2026-10-16", 2, { bodyFocus: "lower" } as Partial<PlannedSession>);
    const v = lowerBodyAfterKeyRun(w, ctx);
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/RPE 8 or less/);
  });

  it("allows lower body at RPE 8 or less the day after a hard run", () => {
    const w = edit("2026-10-16", 2, {
      bodyFocus: "lower",
      exercises: [exercise("Leg press", 8), exercise("Hip thrust", 7.5)],
    } as Partial<PlannedSession>);
    expect(lowerBodyAfterKeyRun(w, ctx)).toEqual([]);
  });

  it("applies after a long run too", () => {
    const w = add(lift("2026-10-18", "full", [exercise("Deadlift", 9)]));
    expect(lowerBodyAfterKeyRun(w, ctx)[0].date).toBe("2026-10-18");
  });
});

describe("easy-running (at least 80%, counted by step effort)", () => {
  const step = (minutes: number, targetRpe: number) => ({ name: "Step", minutes, targetRpe });
  const run = (
    date: string,
    minutes: number,
    steps: ReturnType<typeof step>[],
    intensity: "easy" | "moderate" | "hard" = "hard",
  ): PlannedSession => ({ ...easyRun(date, minutes), intensity, steps }) as PlannedSession;

  it("passes the demo week at 90% easy (intervals' warm-up and cool-down count as easy)", () => {
    expect(easyRunning(week(), ctx)).toEqual([]);
  });

  it("fails when too much running is above easy effort", () => {
    let w = edit("2026-10-13", 1, { steps: [step(30, 6)] } as Partial<PlannedSession>);
    w = edit("2026-10-14", 1, { steps: [step(40, 6)] } as Partial<PlannedSession>, w);
    expect(easyRunning(w, ctx)[0].message).toMatch(/Only 59% .* RPE 4 or less \(136 of 230 min\)/);
  });

  it("counts an interval session's easy warm-up and cool-down", () => {
    const intervals = run("2026-10-15", 45, [step(12, 3), step(24, 8), step(9, 3)]);
    expect(easyRunning(week({ sessions: [intervals, easyRun("2026-10-13", 60)] }), ctx)).toHaveLength(1); // 81 of 105
    expect(easyRunning(week({ sessions: [intervals, easyRun("2026-10-13", 75)] }), ctx)).toEqual([]); // 96 of 120
  });

  it("lets a fast-finish long run fit, counting its easy part", () => {
    const fastFinish = run("2026-10-17", 90, [step(75, 4), step(15, 7)], "moderate");
    expect(easyRunning(week({ sessions: [fastFinish, easyRun("2026-10-14", 30)] }), ctx)).toEqual([]); // 105 of 120
  });

  it("counts runs without steps by their intensity, and passes at exactly 80%", () => {
    const w = week({
      sessions: [easyRun("2026-10-13", 80), { ...easyRun("2026-10-15", 20), intensity: "hard" }],
    });
    expect(easyRunning(w, ctx)).toEqual([]);
  });

  it("ignores weeks with no running", () => {
    expect(easyRunning(week({ sessions: [] }), ctx)).toEqual([]);
  });
});

describe("beginner-easy-running", () => {
  it("does not apply to intermediate athletes", () => {
    expect(beginnerEasyRunning(week(), ctx)).toEqual([]);
  });

  it("rejects any run that is not easy for a beginner", () => {
    const v = beginnerEasyRunning(week(), { ...ctx, experienceLevel: "beginner" });
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/Intervals.*beginners run easy only/);
  });
});

describe("working-sets", () => {
  it("passes 2 working sets on low strength volume", () => {
    expect(workingSets(week(), ctx)).toEqual([]);
  });

  it("rejects anything but exactly 2 working sets on low", () => {
    const w = week({
      sessions: [lift("2026-10-13", "upper", [exercise("Bench", 9, 3), exercise("Row", 9, 1)])],
    });
    expect(workingSets(w, ctx).map((v) => v.message)).toEqual([
      expect.stringMatching(/Bench .* has 3 working sets; low strength volume needs exactly 2/),
      expect.stringMatching(/Row .* has 1 working sets/),
    ]);
  });

  it("defaults to low when no setting is given", () => {
    expect(workingSets(week(), { ...ctx, strengthVolume: undefined })).toEqual([]);
  });

  it("needs exactly 3 working sets on moderate", () => {
    const v = workingSets(week(), { ...ctx, strengthVolume: "moderate" });
    expect(v).toHaveLength(8); // every exercise in the two demo sessions
    expect(v[0].message).toMatch(/has 2 working sets; moderate strength volume needs exactly 3/);
  });

  it("allows 3 or 4 working sets on high", () => {
    const w = week({
      sessions: [lift("2026-10-13", "upper", [exercise("Bench", 9, 3), exercise("Row", 9, 4), exercise("Curl", 9, 2)])],
    });
    const v = workingSets(w, { ...ctx, strengthVolume: "high" });
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/Curl/);
  });
});

describe("consecutive-heavy-legs", () => {
  it("rejects heavy lower-body sessions on consecutive days", () => {
    const w = add(lift("2026-10-14", "lower", [exercise("Leg press", 9)], 2));
    const v = consecutiveHeavyLegs(w, ctx);
    expect(v).toHaveLength(1);
    expect(v[0].date).toBe("2026-10-14");
  });

  it("allows lower body followed by upper body", () => {
    const w = add(lift("2026-10-14", "upper", [exercise("Row", 9)], 2));
    expect(consecutiveHeavyLegs(w, ctx)).toEqual([]);
  });

  it("allows a light full-body day after a heavy leg day", () => {
    const w = add(lift("2026-10-14", "full", [exercise("Goblet squat", 7)], 2));
    expect(consecutiveHeavyLegs(w, ctx)).toEqual([]);
  });
});

describe("strength-effort (most lifts are hard)", () => {
  const session = (rpes: number[]) =>
    week({ sessions: [lift("2026-10-13", "upper", rpes.map((r, i) => exercise(`Lift ${i}`, r)))] });

  it("passes the demo week, where every working set is RPE 8.5+", () => {
    expect(strengthEffort(week(), ctx)).toEqual([]);
  });

  it("passes when most exercises are hard", () => {
    expect(strengthEffort(session([9, 9, 7]), ctx)).toEqual([]);
  });

  it("fails when half or fewer are hard", () => {
    const v = strengthEffort(session([9, 7, 7, 9]), ctx);
    expect(v[0].message).toMatch(/Only 2 of 4 exercises .* RPE 8.5\+/);
  });

  it("uses each strength volume setting's range", () => {
    expect(strengthEffort(session([8, 8, 8]), ctx)).toHaveLength(1); // low: 8.5+
    expect(strengthEffort(session([8, 8, 8]), { ...ctx, strengthVolume: "moderate" })).toEqual([]);
    expect(strengthEffort(session([7.5, 7.5]), { ...ctx, strengthVolume: "high" })).toEqual([]);
  });

  it("skips beginners, recovery and taper weeks", () => {
    const easy = session([6, 6, 6]);
    expect(strengthEffort(easy, { ...ctx, experienceLevel: "beginner" })).toEqual([]);
    expect(strengthEffort({ ...easy, phase: "recovery" }, ctx)).toEqual([]);
    expect(strengthEffort({ ...easy, phase: "taper" }, ctx)).toEqual([]);
  });

  it("skips lower-body work capped at RPE 8 the day after a key run", () => {
    const w = edit("2026-10-16", 2, {
      bodyFocus: "lower",
      exercises: [exercise("Leg press", 8), exercise("Hip thrust", 7.5)],
    } as Partial<PlannedSession>);
    expect(strengthEffort(w, ctx)).toEqual([]);
  });
});

describe("failure-allowed", () => {
  const withExercise = (e: Partial<StrengthExercise>) =>
    week({ sessions: [lift("2026-10-13", "lower", [{ ...exercise("Back squat", 8.5), ...e }])] });

  it("passes the demo week", () => {
    expect(failureAllowedRule(week(), ctx)).toEqual([]);
  });

  it("rejects failure on a barbell lift", () => {
    const v = failureAllowedRule(withExercise({ failureAllowed: true }), ctx);
    expect(v[0].message).toMatch(/Back squat .* can't be taken to failure/);
  });

  it("allows failure on machine and isolation exercises", () => {
    expect(failureAllowedRule(withExercise({ name: "Leg press", failureAllowed: true, targetRpe: 10 }), ctx)).toEqual([]);
    expect(failureAllowedRule(withExercise({ name: "Leg extension", failureAllowed: true, targetRpe: 10 }), ctx)).toEqual([]);
  });

  it("rejects failure on an exercise that isn't in the library", () => {
    const v = failureAllowedRule(withExercise({ name: "Mystery lift", failureAllowed: true }), ctx);
    expect(v[0].message).toMatch(/isn't in ede.'s exercise library/);
  });

  it("keeps heavy barbell lifts at RPE 9 or less", () => {
    const v = failureAllowedRule(withExercise({ targetRpe: 9.5 }), ctx);
    expect(v[0].message).toMatch(/RPE 9.5; keep heavy barbell lifts at RPE 9 or less/);
  });
});

describe("heavy lower-body uses the exercise library", () => {
  it("doesn't count a hard full-body session of upper-body exercises as heavy legs", () => {
    const w = edit("2026-10-16", 2, {
      bodyFocus: "full",
      exercises: [exercise("Bench press", 9), exercise("Pull-up", 9), exercise("Plank", 8)],
    } as Partial<PlannedSession>);
    expect(heavyLegsNearKeyRun(w, ctx)).toEqual([]);
  });

  it("counts a full-body session with a hard lower-body or unknown exercise", () => {
    for (const name of ["Deadlift", "Mystery lift"]) {
      const w = edit("2026-10-16", 2, { bodyFocus: "full", exercises: [exercise(name, 9)] } as Partial<PlannedSession>);
      expect(heavyLegsNearKeyRun(w, ctx), name).toHaveLength(1);
    }
  });
});

describe("injury", () => {
  const mildKnee = { area: "knee", painLevel: 2, painWhen: "running" } as const;
  const noRuns = (w: WeekPlan) => ({ ...w, sessions: w.sessions.filter((s) => s.type !== "run") });
  const upperOnly = week({ sessions: [lift("2026-10-16", "upper", [exercise("Bench press", 9), exercise("Seated cable row", 9)])] });

  it("puts pain into bands: mild, moderate or severe", () => {
    expect(injuryBand({ area: "knee", painLevel: 3, painWhen: "running" })).toBe("mild");
    expect(injuryBand({ area: "knee", painLevel: 3, painWhen: "lifting_only" })).toBe("mild");
    expect(injuryBand({ area: "knee", painLevel: 4, painWhen: "running" })).toBe("moderate");
    expect(injuryBand({ area: "knee", painLevel: 2, painWhen: "walking" })).toBe("moderate");
    expect(injuryBand({ area: "knee", painLevel: 7, painWhen: "running" })).toBe("severe");
    expect(injuryBand({ area: "knee", painLevel: 3, painWhen: "resting" })).toBe("severe");
  });

  it("does nothing without an injury", () => {
    expect(injuryRule(week(), ctx)).toEqual([]);
  });

  describe("mild pain (0-3)", () => {
    const c = { ...ctx, injury: mildKnee };
    const messages = (w: WeekPlan) => injuryRule(w, c).map((v) => v.message).join("\n");

    it("keeps running easy and flat, with no intervals or hills", () => {
      expect(messages(week())).toMatch(/"Intervals" .* must be an easy run/);
    });

    it("cuts running by at least 20% on last week", () => {
      expect(messages(week())).toMatch(/at most 176 run minutes, not 230/);
    });

    it("swaps exercises that load the injured area", () => {
      expect(messages(week())).toMatch(/Back squat .* loads the injured knee/);
    });

    it("passes a reduced week of easy running with lifts that avoid the knee", () => {
      const w = week({
        sessions: [easyRun("2026-10-13", 40), easyRun("2026-10-15", 40), easyRun("2026-10-17", 60), ...upperOnly.sessions],
      });
      expect(injuryRule(w, c)).toEqual([]);
    });
  });

  describe("moderate pain (4-6) or pain when walking", () => {
    const c = { ...ctx, injury: { area: "knee", painLevel: 5, painWhen: "running" } as const };

    it("allows no running and needs a physio or doctor note", () => {
      const text = injuryRule(week(), c).map((v) => v.message).join("\n");
      expect(text).toMatch(/no running this week/);
      expect(text).toMatch(/advise seeing a physio or doctor/);
    });

    it("passes strength that avoids the area, with a physio note", () => {
      expect(injuryRule({ ...upperOnly, coachNote: "Please see a physio about your knee." }, c)).toEqual([]);
    });

    it("treats pain when walking as moderate", () => {
      const walking = { ...ctx, injury: { area: "ankle", painLevel: 2, painWhen: "walking" } as const };
      expect(injuryRule(week(), walking).map((v) => v.message).join()).toMatch(/hurting when walking/);
    });
  });

  describe("severe pain (7+) or pain at rest", () => {
    const c = { ...ctx, injury: { area: "back", painLevel: 8, painWhen: "running" } as const };

    it("allows no lower-body lifting, and needs a doctor note (a physio note isn't enough)", () => {
      const text = injuryRule({ ...noRuns(week()), coachNote: "See a physio." }, c).map((v) => v.message).join("\n");
      expect(text).toMatch(/no lower-body lifting: make "Lower body strength"/);
      expect(text).toMatch(/clearly advise seeing a doctor/);
    });

    it("passes upper-body work that avoids the back, with a doctor note", () => {
      const w = week({ sessions: [lift("2026-10-16", "upper", [exercise("Bench press", 9), exercise("Chest-supported row", 9)])], coachNote: "See a doctor before training." });
      expect(injuryRule(w, c)).toEqual([]);
    });
  });
});

describe("run-progression (run minutes only)", () => {
  it("allows up to 10% more run minutes than the last build week", () => {
    expect(runProgression(week(), { ...ctx, history: [build(300, 210)] })).toEqual([]);
  });

  it("fails a jump of more than 10%", () => {
    const v = runProgression(week(), { ...ctx, history: [build(300, 200)] });
    expect(v[0].message).toMatch(/230 run minutes, up from 200; build gradually to at most 220/);
  });

  it("ignores strength minutes", () => {
    // Total minutes jump from 250 to 310 (+24%), but run minutes only from 220 to 230.
    expect(runProgression(week(), { ...ctx, history: [build(250, 220)] })).toEqual([]);
  });

  it("allows at least 20 extra minutes for low-volume runners", () => {
    const w = week({ sessions: [easyRun("2026-10-13", 45), easyRun("2026-10-15", 45)] });
    expect(runProgression(w, { ...ctx, history: [build(100, 70)] })).toEqual([]);
  });

  it("compares to the last build week, not a recovery week", () => {
    const c = { ...ctx, history: [build(300, 220), recovery(200, 150)] };
    expect(runProgression(week(), c)).toEqual([]);
  });

  it("does not apply in recovery or taper weeks", () => {
    const c = { ...ctx, history: [build(100, 70)] };
    expect(runProgression(week({ phase: "recovery" }), c)).toEqual([]);
    expect(runProgression(week({ phase: "taper" }), c)).toEqual([]);
  });

  describe("starting load", () => {
    const start = week({
      sessions: [easyRun("2026-10-13", 25), easyRun("2026-10-15", 25), easyRun("2026-10-17", 30)],
    });

    it("applies when there is no history, and rejects too much running", () => {
      const v = runProgression(week(), { ...ctx, history: [] });
      expect(v.map((x) => x.message).join("\n")).toMatch(/run minutes should be 60-90 .* not 230/);
      expect(v.map((x) => x.message).join("\n")).toMatch(/2-3 runs, not 5/);
    });

    it("applies when last week had under 60 run minutes", () => {
      expect(runProgression(week(), { ...ctx, history: [build(150, 50)] })).not.toEqual([]);
    });

    it("passes 60-90 run minutes over 2-3 runs", () => {
      expect(runProgression(start, { ...ctx, history: [] })).toEqual([]);
    });

    it("uses 40-60 run minutes for beginners", () => {
      const beginner = { ...ctx, history: [], experienceLevel: "beginner" as const };
      expect(runProgression(start, beginner)[0].message).toMatch(/40-60 for a beginner/);
      const gentle = week({
        sessions: [easyRun("2026-10-13", 15), easyRun("2026-10-15", 15), easyRun("2026-10-17", 20)],
      });
      expect(runProgression(gentle, beginner)).toEqual([]);
    });
  });
});

describe("recovery-week (cut at least 30%)", () => {
  it("requires a recovery week after 3 build weeks in a row", () => {
    const v = recoveryWeek(week(), { ...ctx, history: [build(280), build(290), build(300)] });
    expect(v[0].message).toMatch(/must be a recovery week/);
  });

  it("rejects a recovery week that comes too soon", () => {
    const v = recoveryWeek(week({ phase: "recovery" }), { ...ctx, history: [build(500)] });
    expect(v[0].message).toMatch(/too soon/);
  });

  it("passes a recovery week at 70% or less of the last build week", () => {
    const c = { ...ctx, history: [build(420), build(450)] };
    expect(recoveryWeek(week({ phase: "recovery" }), c)).toEqual([]);
  });

  it("rejects a recovery week that cuts less than 30%", () => {
    const c = { ...ctx, history: [build(300), build(320)] };
    const v = recoveryWeek(week({ phase: "recovery" }), c);
    expect(v[0].message).toMatch(/at most 224 min \(at least 30% less/);
  });
});

describe("taper", () => {
  const raceSunday = "2026-10-18";
  const nextSunday = "2026-10-25";
  const inTwoWeeks = "2026-11-01";

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

  it("uses a 2-week taper for races up to 100K", () => {
    const c = { ...ctx, targetDate: inTwoWeeks, ultraDistanceKm: 100 };
    expect(taper(week(), c)).toEqual([]);
  });

  it("uses a 3-week taper for 100-mile ultras, at 90% three weeks out", () => {
    const c = { ...ctx, targetDate: inTwoWeeks, ultraDistanceKm: 161, history: [build(330)] };
    expect(taper(week(), c)[0].message).toMatch(/must be a taper week/);
    expect(taper(week({ phase: "taper" }), c)[0].message).toMatch(/at most 297 min/);
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

describe("session-variety", () => {
  const quality = (kind: "tempo" | "hills" | "intervals_short", level: number, date = "2026-10-15"): PlannedSession => ({
    ...easyRun(date, 45),
    title: kind,
    intensity: "hard",
    kind,
    level,
  }) as PlannedSession;
  const withQuality = (...sessions: PlannedSession[]) => week({ sessions });
  const past = (q: { kind: "tempo" | "hills" | "intervals_short"; level: number }[]): PastWeek => ({
    ...build(300, 220),
    quality: q,
  });

  it("passes when this week's quality session differs from last week's", () => {
    const c = { ...ctx, history: [past([{ kind: "tempo", level: 2 }])] };
    expect(sessionVariety(withQuality(quality("hills", 1)), c)).toEqual([]);
  });

  it("rejects the same quality session two weeks running", () => {
    const c = { ...ctx, history: [past([{ kind: "tempo", level: 2 }])] };
    const v = sessionVariety(withQuality(quality("tempo", 3)), c);
    expect(v[0].message).toMatch(/Last week's quality sessions were Tempo run/);
  });

  it("allows one of two quality sessions to carry over", () => {
    const c = { ...ctx, history: [past([{ kind: "tempo", level: 2 }, { kind: "hills", level: 1 }])] };
    expect(sessionVariety(withQuality(quality("hills", 2), quality("intervals_short", 1, "2026-10-17")), c)).toEqual([]);
  });

  it("rejects a session type coming back at a lower level", () => {
    const c = { ...ctx, history: [past([{ kind: "hills", level: 3 }]), past([{ kind: "tempo", level: 2 }])] };
    const v = sessionVariety(withQuality(quality("hills", 2)), c);
    expect(v[0].message).toMatch(/level 2, but Hill repeats was last done at level 3/);
  });

  it("allows a lower level in recovery and taper weeks", () => {
    const c = { ...ctx, history: [past([{ kind: "hills", level: 3 }]), past([{ kind: "tempo", level: 2 }])] };
    expect(sessionVariety({ ...withQuality(quality("hills", 2)), phase: "taper" }, c)).toEqual([]);
  });

  it("skips runs without a library kind (as in the demo week)", () => {
    const c = { ...ctx, history: [past([{ kind: "tempo", level: 2 }])] };
    expect(sessionVariety(week(), c)).toEqual([]);
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
