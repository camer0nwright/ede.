import { describe, expect, it } from "vitest";
import { ALL_RULES, runMinutes, totalMinutes, type CheckContext, type PastWeek } from "@/server/plan-checker/rules";
import { PROFILES } from "@/test/profiles";
import { BODY_FOCUSES, GYM_SPLITS, isUpperOnly, type GymSplit, type WeekPlan } from "./domain";
import { findExercise } from "./exercise-library";
import { splitNote } from "./onboarding";
import { buildPlanOutline, defaultSplit, SPLIT_SEQUENCE, splitFor, type OutlineInput } from "./plan-outline";
import { RUN_LIBRARY } from "./session-library";
import { buildStrengthSession, EQUIPMENT_FROM_ANSWERS, equipmentFromAnswers, focusTitle } from "./strength-builder";
import { buildPlanWeeks } from "./week-builder";

// Gym splits (SPEC decision 75): Upper/Lower, Push/Pull/Legs, Arnold and Full
// body, a default for the number of gym days, and a rotation that carries on
// across weeks when the split doesn't fit the week.

describe("the default split", () => {
  it("follows the number of gym days", () => {
    expect(defaultSplit(1, "intermediate")).toBe("full_body");
    expect(defaultSplit(2, "intermediate")).toBe("upper_lower");
    expect(defaultSplit(3, "advanced")).toBe("ppl");
    expect(defaultSplit(4, "intermediate")).toBe("upper_lower");
    expect(defaultSplit(5, "intermediate")).toBe("ppl");
  });

  it("is full body for beginners", () => {
    for (const lifts of [1, 2, 3, 4]) expect(defaultSplit(lifts, "beginner")).toBe("full_body");
  });

  it("gives way to the athlete's choice", () => {
    expect(splitFor({ ...PROFILES["general fitness, no date"], liftsPerWeek: 3 })).toBe("ppl");
    expect(splitFor({ ...PROFILES["general fitness, no date"], liftsPerWeek: 3, gymSplit: "arnold" })).toBe("arnold");
  });
});

const general: OutlineInput = { ...PROFILES["general fitness, no date"], runsPerWeek: 3 };
const focusesByWeek = (input: OutlineInput) => buildPlanOutline(input).weeks.map((w) => w.strength.map((s) => s.focus));

describe("rotating the split", () => {
  it("runs Push/Pull/Legs in order on 3 gym days", () => {
    const weeks = focusesByWeek({ ...general, liftsPerWeek: 3, gymSplit: "ppl" });
    expect(weeks[0]).toEqual(["push", "pull", "lower"]);
    expect(weeks[1]).toEqual(["push", "pull", "lower"]);
  });

  it("carries on from last week when the split doesn't fit the gym days", () => {
    const weeks = focusesByWeek({ ...general, liftsPerWeek: 2, gymSplit: "ppl" });
    expect(weeks.slice(0, 3)).toEqual([
      ["push", "pull"],
      ["lower", "push"],
      ["pull", "lower"],
    ]);
  });

  it("alternates Upper/Lower on an odd number of gym days", () => {
    const weeks = focusesByWeek({ ...general, liftsPerWeek: 3, gymSplit: "upper_lower" });
    expect(weeks[0]).toEqual(["lower", "upper", "lower"]);
    expect(weeks[1]).toEqual(["upper", "lower", "upper"]);
  });

  it("gives Arnold's three sessions and full body's one", () => {
    expect(focusesByWeek({ ...general, liftsPerWeek: 3, gymSplit: "arnold" })[0]).toEqual(["chest_back", "shoulders_arms", "lower"]);
    expect(focusesByWeek({ ...general, liftsPerWeek: 2, gymSplit: "full_body" })[0]).toEqual(["full", "full"]);
  });

  it("does every session of the split equally often over a plan", () => {
    for (const split of GYM_SPLITS) {
      const counts = new Map<string, number>();
      for (const week of focusesByWeek({ ...general, liftsPerWeek: 2, gymSplit: split })) for (const f of week) counts.set(f, (counts.get(f) ?? 0) + 1);
      const values = [...counts.values()];
      expect(new Set(counts.keys()), split).toEqual(new Set(SPLIT_SEQUENCE[split]));
      expect(Math.max(...values) - Math.min(...values), split).toBeLessThanOrEqual(1);
    }
  });

  it("keeps race week to the split's upper-body sessions", () => {
    const race = PROFILES["half marathon, chosen 4 runs and 3 lifts"];
    const last = (split: GymSplit) => buildPlanOutline({ ...race, gymSplit: split }).weeks.at(-1)!.strength.map((s) => s.focus);
    expect(last("ppl")).toEqual(["push", "pull", "push"]);
    expect(last("arnold")).toEqual(["chest_back", "shoulders_arms", "chest_back"]);
    expect(last("upper_lower")).toEqual(["upper", "upper", "upper"]);
    expect(last("full_body")).toEqual(["upper", "upper", "upper"]);
  });
});

describe("split sessions", () => {
  const request = { volume: "high" as const, effort: "hard" as const, block: 1, variant: "A" as const };

  it("never put leg exercises in an upper-body session, with any equipment", () => {
    for (const focus of BODY_FOCUSES.filter(isUpperOnly)) {
      for (const answer of Object.keys(EQUIPMENT_FROM_ANSWERS)) {
        const { exercises } = buildStrengthSession({ ...request, focus, equipment: equipmentFromAnswers([answer]) });
        expect(exercises.filter((e) => findExercise(e.name)?.isLowerBody), `${focus} with ${answer}`).toEqual([]);
      }
    }
  });

  it("fill every volume's exercise count in a full gym", () => {
    for (const focus of BODY_FOCUSES) {
      const at = (volume: "low" | "moderate" | "high") => buildStrengthSession({ ...request, volume, focus, equipment: equipmentFromAnswers(["Full gym"]) }).exercises.length;
      expect(at("low"), focus).toBe(4);
      expect(at("moderate"), focus).toBe(6);
      expect(at("high"), focus).toBe(8);
    }
  });

  it("still have at least 3 exercises with bodyweight only", () => {
    for (const focus of BODY_FOCUSES) {
      const { exercises } = buildStrengthSession({ ...request, focus, equipment: equipmentFromAnswers(["Bodyweight only"]) });
      expect(exercises.length, focus).toBeGreaterThanOrEqual(3);
    }
  });

  it("work the right muscles", () => {
    const groups = (focus: (typeof BODY_FOCUSES)[number]) =>
      new Set(buildStrengthSession({ ...request, focus, equipment: equipmentFromAnswers(["Full gym"]) }).exercises.map((e) => findExercise(e.name)!.muscleGroup));
    expect(groups("push")).toEqual(new Set(["Chest", "Shoulders", "Triceps", "Core"]));
    expect(groups("pull")).toEqual(new Set(["Back", "Rear shoulders", "Biceps", "Core"]));
    expect([...groups("chest_back")].every((g) => ["Chest", "Back", "Rear shoulders", "Core"].includes(g))).toBe(true);
    expect([...groups("shoulders_arms")].every((g) => ["Shoulders", "Rear shoulders", "Biceps", "Triceps", "Core"].includes(g))).toBe(true);
  });

  it("are titled by the split", () => {
    expect(focusTitle("lower", "ppl")).toBe("Legs");
    expect(focusTitle("lower", "arnold")).toBe("Legs");
    expect(focusTitle("lower", "upper_lower")).toBe("Lower body");
    expect(focusTitle("push")).toBe("Push");
    expect(focusTitle("chest_back")).toBe("Chest and back");
    expect(focusTitle("shoulders_arms")).toBe("Shoulders and arms");
  });
});

describe("the rotation note in setup", () => {
  it("only shows when the split doesn't fit the gym days", () => {
    expect(splitNote("ppl", 3)).toBeNull();
    expect(splitNote("upper_lower", 4)).toBeNull();
    expect(splitNote("full_body", 2)).toBeNull();
    expect(splitNote("ppl", 2)).toMatch(/Push\/Pull\/Legs has 3 different sessions and you have 2 gym days, so it rotates/);
    expect(splitNote("upper_lower", 3)).toMatch(/rotates/);
  });
});

// Every split, built into full weeks and judged by the whole plan checker.
function violations(input: OutlineInput) {
  const outline = buildPlanOutline(input);
  const ultra = input.raceDistance === "ultra";
  const built = buildPlanWeeks(outline, {
    availability: input.availability,
    ultra,
    strengthVolume: input.strengthVolume,
    experienceLevel: input.experienceLevel,
    equipment: equipmentFromAnswers(["Full gym"]),
    gymSplit: splitFor(input),
  });
  const history: PastWeek[] = [];
  return built.flatMap(({ week, placed }, i) => {
    const ctx: CheckContext = {
      availability: input.availability,
      history: [...history],
      lastWeekRunMinutes: input.lastWeekRunMinutes,
      targetDate: input.targetDate,
      experienceLevel: input.experienceLevel,
      strengthVolume: input.strengthVolume,
      ...(ultra && { ultraDistanceKm: input.ultraDistanceKm }),
    };
    history.push(pastWeek(week));
    const found = ALL_RULES.flatMap((rule) => rule(week, ctx)).map((v) => `week ${i + 1} [${v.rule}] ${v.message}`);
    return placed ? found : [`week ${i + 1} not placed`, ...found];
  });
}

function pastWeek(w: WeekPlan): PastWeek {
  const quality = w.sessions.flatMap((s) => (s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality" ? [{ kind: s.kind, level: s.level ?? 1 }] : []));
  return { totalMinutes: totalMinutes(w), runMinutes: runMinutes(w), phase: w.phase, ...(quality.length > 0 && { quality }) };
}

describe.each(GYM_SPLITS)("built plans with %s", (split) => {
  it.each([
    "half marathon, intermediate",
    "marathon, advanced",
    "half marathon, chosen 4 runs and 3 lifts",
    "half marathon, 3 runs on 45-minute weekdays",
    "strength goal, moderate volume",
    "beginner 5K",
  ])("pass every plan checker rule: %s", (name) => {
    expect(violations({ ...PROFILES[name], gymSplit: split })).toEqual([]);
  });

  it("pass on 2 and 4 gym days too", () => {
    for (const liftsPerWeek of [2, 4]) {
      expect(violations({ ...PROFILES["half marathon, intermediate"], runsPerWeek: 3, liftsPerWeek, gymSplit: split }), `${liftsPerWeek} lifts`).toEqual([]);
    }
  });
});
