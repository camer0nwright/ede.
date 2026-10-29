import { describe, expect, it } from "vitest";
import { failureAllowedRule, strengthEffort, workingSets, type CheckContext } from "@/server/plan-checker/rules";
import type { BodyFocus, PlannedSession, StrengthVolume } from "./domain";
import { findExercise } from "./exercise-library";
import { buildStrengthSession, equipmentFromAnswers, type StrengthRequest } from "./strength-builder";

const gym = equipmentFromAnswers(["Full gym"]);
const base: StrengthRequest = { focus: "lower", volume: "moderate", effort: "hard", equipment: gym, block: 1, variant: "A" };
const names = (r: StrengthRequest) => buildStrengthSession(r).exercises.map((e) => e.name);

/** A built session as a planned session, so the plan checker's strength rules can judge it. */
function asWeek(r: StrengthRequest) {
  const s = buildStrengthSession(r);
  const session: PlannedSession = {
    date: "2026-10-13",
    slot: 1,
    type: "strength",
    title: "Lift",
    intensity: "hard",
    plannedMinutes: s.minutes,
    isKeySession: false,
    bodyFocus: r.focus,
    exercises: s.exercises,
  };
  return { weekStart: "2026-10-12", weekNumber: 1, phase: "build" as const, sessions: [session], dayNotes: {}, coachNote: "" };
}

const FOCUSES: BodyFocus[] = ["lower", "upper", "full"];
const VOLUMES: StrengthVolume[] = ["low", "moderate", "high"];

describe("strength builder", () => {
  describe.each(VOLUMES)("%s volume", (volume) => {
    it.each(FOCUSES)("builds a %s session the plan checker accepts", (focus) => {
      const r = { ...base, focus, volume };
      const ctx: CheckContext = { availability: [], history: [], strengthVolume: volume };
      const week = asWeek(r);
      expect(workingSets(week, ctx)).toEqual([]);
      expect(failureAllowedRule(week, ctx)).toEqual([]);
      expect(strengthEffort(week, ctx)).toEqual([]);
    });
  });

  it("uses the exercise counts: Low 3-4, Moderate 5-6, Higher 7-8 (SPEC decision 74)", () => {
    const ranges = { low: [3, 4], moderate: [5, 6], high: [7, 8] } as const;
    for (const focus of FOCUSES) {
      for (const volume of VOLUMES) {
        const n = names({ ...base, focus, volume }).length;
        expect(n, `${volume} ${focus}`).toBeGreaterThanOrEqual(ranges[volume][0]);
        expect(n, `${volume} ${focus}`).toBeLessThanOrEqual(ranges[volume][1]);
      }
    }
  });

  it("gives every exercise 2 working sets at every volume", () => {
    for (const focus of FOCUSES) for (const volume of VOLUMES) for (const e of buildStrengthSession({ ...base, focus, volume }).exercises) expect(e.workingSets).toBe(2);
  });

  it("takes sets to failure except heavy barbell lifts, which stop one rep short", () => {
    const s = buildStrengthSession({ ...base, focus: "full", volume: "high" }).exercises;
    for (const e of s) {
      const info = findExercise(e.name)!;
      const core = ["Pallof press", "Dead bug", "Plank", "Hanging knee raise"].includes(e.name);
      if (core) expect(e.targetRpe).toBe(9);
      else if (info.equipment === "barbell" && info.category === "compound") expect([e.targetRpe, e.failureAllowed]).toEqual([9, false]);
      else expect([e.targetRpe, e.failureAllowed]).toEqual([10, true]);
    }
  });

  it("warms up once per muscle group, before its first exercise", () => {
    for (const focus of FOCUSES) {
      const s = buildStrengthSession({ ...base, focus, volume: "high" }).exercises;
      const seen = new Set<string>();
      for (const e of s) {
        const info = findExercise(e.name)!;
        expect(e.warmupSets).toBeLessThanOrEqual(1);
        if (e.warmupSets === 1) {
          expect(seen.has(info.muscleGroup), `${e.name} warms up ${info.muscleGroup} twice`).toBe(false);
        }
        seen.add(info.muscleGroup);
      }
      expect(s[0].warmupSets).toBe(1);
    }
  });

  it("keeps main lifts the same within a block and rotates accessories A/B", () => {
    const a = buildStrengthSession({ ...base, variant: "A" }).exercises;
    const b = buildStrengthSession({ ...base, variant: "B" }).exercises;
    expect(a.filter((e) => e.isMainLift).map((e) => e.name)).toEqual(b.filter((e) => e.isMainLift).map((e) => e.name));
    expect(a.filter((e) => !e.isMainLift).map((e) => e.name)).not.toEqual(b.filter((e) => !e.isMainLift).map((e) => e.name));
  });

  it("changes main lifts between blocks", () => {
    const main = (block: number) => buildStrengthSession({ ...base, block }).exercises.filter((e) => e.isMainLift).map((e) => e.name);
    expect(main(1)).not.toEqual(main(2));
    expect(main(1)).toEqual(main(3));
  });

  it("only uses the equipment available", () => {
    for (const answer of ["Dumbbells", "Bodyweight only", "Resistance bands", "Machines and cables"]) {
      const equipment = equipmentFromAnswers([answer]);
      for (const focus of FOCUSES) {
        const built = names({ ...base, focus, equipment });
        expect(built.length, `${answer} ${focus}`).toBeGreaterThanOrEqual(2);
        for (const n of built) expect(equipment, `${n} with ${answer}`).toContain(findExercise(n)!.equipment);
      }
    }
  });

  it("avoids exercises that load an injured area", () => {
    for (const n of names({ ...base, avoid: "knee" })) expect(findExercise(n)!.loads).not.toContain("knee");
  });

  it("keeps beginners off barbell lifts", () => {
    for (const focus of FOCUSES) {
      for (const n of names({ ...base, focus, avoidBarbell: true })) expect(findExercise(n)!.equipment).not.toBe("barbell");
    }
  });

  it("caps lower-body effort the day after a hard or long run", () => {
    const s = buildStrengthSession({ ...base, maxLowerRpe: 8 });
    // Legs and core both stay easier that day.
    for (const e of s.exercises) if (findExercise(e.name)!.isLowerBody || e.name === "Pallof press" || e.name === "Plank") expect(e.targetRpe).toBeLessThanOrEqual(8);
  });

  it("makes light weeks lighter but keeps the same working sets", () => {
    const hard = buildStrengthSession(base).exercises;
    const light = buildStrengthSession({ ...base, effort: "light" }).exercises;
    expect(light.map((e) => e.workingSets)).toEqual(hard.map((e) => e.workingSets));
    expect(Math.max(...light.map((e) => e.targetRpe))).toBeLessThanOrEqual(7);
  });

  it("drops exercises from the end to fit the time available", () => {
    const full = buildStrengthSession(base);
    const short = buildStrengthSession({ ...base, maxMinutes: 40 });
    expect(short.exercises.length).toBeLessThan(full.exercises.length);
    expect(short.minutes).toBeLessThanOrEqual(40);
    expect(short.exercises.map((e) => e.name)).toEqual(full.exercises.slice(0, short.exercises.length).map((e) => e.name));
  });

  it("uses realistic reps for unloaded and very hard exercises", () => {
    const bw = buildStrengthSession({ ...base, equipment: equipmentFromAnswers(["Bodyweight only"]) }).exercises;
    expect(bw.find((e) => e.name === "Bodyweight squat")?.reps).toBe("12-20");
    expect(bw.find((e) => e.name === "Nordic curl")?.reps).toBe("4-6");
  });
});
