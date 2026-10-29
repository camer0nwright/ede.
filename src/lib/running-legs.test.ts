import { describe, expect, it } from "vitest";
import { plyometrics, injuryRule, strengthEffort, type CheckContext } from "@/server/plan-checker/rules";
import { build, equipment } from "@/test/injured-plan";
import { PROFILES } from "@/test/profiles";
import type { PlannedSession, StrengthExercise, WeekPlan } from "./domain";
import { findExercise, isPlyo } from "./exercise-library";
import { adaptWeekForInjury } from "./injury";
import { buildPlanOutline } from "./plan-outline";
import { buildStrengthSession, equipmentFromAnswers, PLYO_RPE, type StrengthRequest } from "./strength-builder";
import { buildPlanWeeks } from "./week-builder";
import { suggestNext } from "./progression";
import { effortWords } from "./workout";

// Running-specific leg days and plyometrics (SPEC decision 76).

const legDay: StrengthRequest = { focus: "lower", volume: "moderate", effort: "hard", equipment: equipmentFromAnswers(["Full gym"]), block: 1, variant: "A", plyos: "standard" };
const names = (req: StrengthRequest) => buildStrengthSession(req).exercises.map((e) => e.name);
const SINGLE_LEG = ["Bulgarian split squat", "Reverse lunge", "Step-up", "Split squat", "Single-leg Romanian deadlift"];

describe("running-specific leg days", () => {
  it("have single-leg work and calves at every volume", () => {
    for (const volume of ["low", "moderate", "high"] as const) {
      const ex = names({ ...legDay, volume });
      expect(ex.some((n) => SINGLE_LEG.includes(n)), volume).toBe(true);
      expect(ex.some((n) => findExercise(n)?.muscleGroup === "Calves"), volume).toBe(true);
    }
  });

  it("add a single-leg hinge from Moderate, and soleus work at Higher", () => {
    expect(names(legDay)).toContain("Single-leg Romanian deadlift");
    expect(names({ ...legDay, volume: "high" })).toContain("Seated calf raise");
  });

  it("still have single-leg work and soleus raises with bodyweight only", () => {
    const ex = names({ ...legDay, volume: "high", equipment: equipmentFromAnswers(["Bodyweight only"]) });
    expect(ex.some((n) => SINGLE_LEG.includes(n))).toBe(true);
    expect(ex).toContain("Bent-knee calf raise");
  });
});

describe("plyometrics", () => {
  it("open a hard leg day, on top of the volume's exercise count", () => {
    const { exercises } = buildStrengthSession(legDay);
    expect(isPlyo(exercises[0].name)).toBe(true);
    expect(exercises.filter((e) => !isPlyo(e.name))).toHaveLength(6);
    expect(exercises[0]).toMatchObject({ warmupSets: 0, workingSets: 2, targetRpe: PLYO_RPE, failureAllowed: false });
  });

  it("are on full-body days too, but never upper-body ones", () => {
    expect(isPlyo(names({ ...legDay, focus: "full" })[0])).toBe(true);
    for (const focus of ["upper", "push", "pull", "chest_back", "shoulders_arms"] as const) expect(names({ ...legDay, focus }).some(isPlyo), focus).toBe(false);
  });

  it("are gentle for beginners", () => {
    const first = names({ ...legDay, plyos: "gentle" })[0];
    expect(findExercise(first)?.plyo).toBe("gentle");
  });

  it("rotate between blocks and weeks", () => {
    const picks = new Set([1, 2, 3].flatMap((block) => (["A", "B"] as const).map((variant) => names({ ...legDay, block, variant })[0])));
    expect(picks.size).toBeGreaterThan(2);
  });

  it("are left out of light and technique weeks, with an injury, and the day after a key run", () => {
    for (const change of [{ effort: "light" }, { effort: "technique" }, { avoid: "back" }, { maxLowerRpe: 8 }, { plyos: undefined }] as Partial<StrengthRequest>[]) {
      expect(names({ ...legDay, ...change }).some(isPlyo), JSON.stringify(change)).toBe(false);
    }
  });

  it("go before the lifts when a short day needs trimming", () => {
    const { exercises } = buildStrengthSession({ ...legDay, maxMinutes: 20 });
    expect(exercises.some((e) => isPlyo(e.name))).toBe(false);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
  });

  it("never get a heavier or more-reps suggestion", () => {
    const done = [1, 2].map((setNumber) => ({ exercise: "Box jump", setNumber, setType: "working" as const, reps: 5, weightKg: null, rpe: 6 }));
    expect(suggestNext({ name: "Box jump", warmupSets: 0, workingSets: 2, reps: "5", targetRpe: 7, failureAllowed: false }, done, "kg")).toBeUndefined();
  });

  it("are described as quick and springy, not by reps short of failure", () => {
    expect(effortWords(7, "5", "Box jump")).toMatch(/springy/);
    expect(effortWords(7, "10-15", "Leg extension")).toBe("Comfortable: 3 reps short");
  });
});

describe("plyometrics in built plans", () => {
  const plyoSessions = (input = PROFILES["half marathon, intermediate"]) =>
    buildPlanWeeks(buildPlanOutline(input), build(input)).flatMap(({ week }) =>
      week.sessions.flatMap((s) => (s.type === "strength" && s.exercises.some((e) => isPlyo(e.name)) ? [{ week: week.weekNumber, s }] : [])),
    );

  it("appear for everyone", () => {
    for (const name of ["half marathon, intermediate", "marathon, advanced", "strength goal, moderate volume", "beginner 5K"]) {
      expect(plyoSessions(PROFILES[name]).length, name).toBeGreaterThan(0);
    }
  });

  it("wait until a beginner's fifth week, and stay gentle", () => {
    const found = plyoSessions(PROFILES["beginner 5K"]);
    expect(Math.min(...found.map((f) => f.week))).toBeGreaterThanOrEqual(5);
    for (const { s } of found) if (s.type === "strength") for (const e of s.exercises) if (isPlyo(e.name)) expect(findExercise(e.name)?.plyo).toBe("gentle");
  });

  it("are taken out when an injury starts", () => {
    const input = PROFILES["half marathon, intermediate"];
    const outline = buildPlanOutline(input);
    const weeks = buildPlanWeeks(outline, build(input)).map((b) => b.week);
    const week = weeks.find((w) => w.sessions.some((s) => s.type === "strength" && s.exercises.some((e) => isPlyo(e.name))))!;
    const block = outline.weeks[week.weekNumber - 1].block;
    const adapted = adaptWeekForInjury(week, { injury: { area: "shoulder", painLevel: 3, painWhen: "lifting_only" }, from: week.weekStart, beforeRunMinutes: 120, strength: { volume: input.strengthVolume, equipment, block } });
    expect(adapted.sessions.some((s) => s.type === "strength" && s.exercises.some((e) => isPlyo(e.name)))).toBe(false);
  });
});

// ---------- the plan checker ----------

const ex = (name: string, targetRpe: number, failureAllowed = false): StrengthExercise => ({ name, warmupSets: 0, workingSets: 2, reps: "5", targetRpe, failureAllowed });
const lift = (date: string, exercises: StrengthExercise[]): PlannedSession => ({ date, slot: 1, type: "strength", title: "Legs", intensity: "hard", plannedMinutes: 45, isKeySession: false, bodyFocus: "lower", exercises });
const tempo: PlannedSession = { date: "2026-10-15", slot: 1, type: "run", title: "Tempo run", intensity: "hard", plannedMinutes: 40, isKeySession: true, steps: [{ name: "Tempo", minutes: 40, targetRpe: 7 }] };
const week = (...sessions: PlannedSession[]): WeekPlan => ({ weekStart: "2026-10-12", weekNumber: 3, phase: "build", runMinutes: 40, strengthMinutes: 45, coachNote: "", sessions } as unknown as WeekPlan);
const ctx: CheckContext = { availability: PROFILES["half marathon, intermediate"].availability, history: [] };

describe("the plyometrics rule", () => {
  it("passes springy jumps away from hard and long runs", () => {
    expect(plyometrics(week(tempo, lift("2026-10-12", [ex("Box jump", 7), ex("Back squat", 9)])), ctx)).toEqual([]);
  });

  it("rejects jumps to failure or above RPE 8", () => {
    expect(plyometrics(week(lift("2026-10-12", [ex("Box jump", 9)])), ctx)[0].message).toMatch(/springy/);
    expect(plyometrics(week(lift("2026-10-12", [ex("Bounding", 7, true)])), ctx)).toHaveLength(1);
  });

  it("rejects jumps the day before, the day of, and the day after a hard or long run", () => {
    for (const date of ["2026-10-14", "2026-10-15", "2026-10-16"]) {
      expect(plyometrics(week(tempo, lift(date, [ex("Pogo hops", 7)])), ctx), date).toHaveLength(1);
    }
  });

  it("keeps beginners to gentle jumps", () => {
    expect(plyometrics(week(lift("2026-10-12", [ex("Bounding", 7)])), { ...ctx, experienceLevel: "beginner" })[0].message).toMatch(/beginner/);
    expect(plyometrics(week(lift("2026-10-12", [ex("Pogo hops", 7)])), { ...ctx, experienceLevel: "beginner" })).toEqual([]);
  });

  it("doesn't count jumps when judging whether lifts are hard", () => {
    expect(strengthEffort(week(lift("2026-10-12", [ex("Box jump", 7), ex("Back squat", 9), ex("Leg press", 10)])), ctx)).toEqual([]);
  });

  it("allows no jumping with an injury", () => {
    const v = injuryRule(week(lift("2026-10-12", [ex("Pogo hops", 7)])), { ...ctx, injury: { area: "shoulder", painLevel: 3, painWhen: "lifting_only" } });
    expect(v.some((x) => /no jumping/.test(x.message))).toBe(true);
  });
});
