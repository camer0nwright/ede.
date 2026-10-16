// Next session's targets from what was lifted last time (SPEC: Gym sessions
// and logging, double progression), and the exercises a workout can swap to or
// add. Plain code: the plan, not the AI, decides when the weight goes up.
import type { BodyArea, Equipment, StrengthExercise } from "./domain";
import { EXERCISES, failureAllowed, findExercise, weightStepKg, type ExerciseInfo } from "./exercise-library";
import { formatWeight, type LoggedSet, type WeightUnit } from "./workout";

/** "8-10" → [8, 10], "5" → [5, 5]. Timed holds ("30-45s") have no rep range. */
export function repRange(reps: string): [number, number] | null {
  if (/s\s*$/i.test(reps.trim())) return null;
  const nums = reps.match(/\d+/g)?.map(Number);
  if (!nums?.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

/** The smallest sensible weight step in the athlete's unit: plates are 2.5 kg or 5 lb. */
export function weightStep(info: ExerciseInfo | undefined, unit: WeightUnit): number {
  const kg = info ? weightStepKg(info) : 2.5;
  if (kg === 0) return 0;
  if (unit === "kg") return kg;
  return info?.equipment === "barbell" ? 5 : 2.5;
}

export type Suggestion = {
  /** Weight to load, in the athlete's unit (absent for bodyweight work). */
  weight?: string;
  /** Reps to aim for on each working set. */
  reps: number;
  kind: "up" | "more-reps" | "hold";
  note: string;
};

/**
 * Double progression: if every working set last time reached the top of the
 * rep range at or under the target effort, add one weight step; otherwise keep
 * the weight and aim for one more rep. `hold` keeps the weight for a reason
 * (a lighter week, an injury). No history means no suggestion: the athlete
 * starts with their own weights.
 */
export function suggestNext(planned: StrengthExercise, last: LoggedSet[], unit: WeightUnit, hold?: string): Suggestion | undefined {
  const range = repRange(planned.reps);
  const working = last.filter((s) => s.setType !== "warmup" && s.reps !== null && s.reps > 0);
  if (!range || working.length === 0) return undefined;
  const [, top] = range;
  const weighted = working.filter((s) => s.weightKg !== null && s.weightKg > 0);
  const kg = weighted.length > 0 ? Math.max(...weighted.map((s) => s.weightKg!)) : undefined;
  // Judge the sets done at the top weight (lighter back-off sets don't hold it back).
  const judged = kg === undefined ? working : working.filter((s) => s.weightKg === kg);
  const fewest = Math.min(...judged.map((s) => s.reps!));
  const same = kg === undefined ? undefined : formatWeight(kg, unit);
  const nextReps = Math.min(top, Math.max(range[0], fewest + 1));

  if (hold) return { weight: same, reps: fewest >= top ? top : nextReps, kind: "hold", note: `Same as last time: ${hold}.` };

  const effortOk = judged.every((s) => s.rpe === null || s.rpe <= planned.targetRpe + 0.5);
  // Every planned working set has to have been done, not just the ones that were logged.
  if (working.length < planned.workingSets) {
    return { weight: same, reps: nextReps, kind: "more-reps", note: `Same weight: last time you logged ${working.length} of ${planned.workingSets} sets. Aim for all of them.` };
  }
  const step = weightStep(findExercise(planned.name), unit);
  if (fewest >= top && effortOk) {
    if (kg === undefined || step === 0) {
      return { reps: top + 1, kind: "more-reps", note: `You hit ${top} reps on every set last time. Try ${top + 1}, or make it harder.` };
    }
    const up = formatWeight(kg, unit);
    const weight = String(Number(up) + step);
    return { weight, reps: range[0], kind: "up", note: `Up ${step} ${unit}: you hit ${top} reps on every set last time.` };
  }
  return {
    weight: same,
    reps: nextReps,
    kind: "more-reps",
    note: fewest >= top ? `Same weight: last time felt harder than the target. Aim for ${top} reps again.` : `Same weight: aim for ${nextReps} reps on each set.`,
  };
}

/** Why progression holds this week, if it does. */
export function holdReason(opts: { phase: string; injuryArea?: BodyArea; light: boolean }): string | undefined {
  if (opts.injuryArea) return `go steady while your ${opts.injuryArea === "other" ? "injury" : opts.injuryArea} settles`;
  if (opts.phase === "recovery") return "it's a lighter week";
  if (opts.phase === "taper") return "you're easing off before race day";
  if (opts.light) return "it's a lighter session";
  return undefined;
}

const usable = (e: ExerciseInfo, equipment: Equipment[], avoid?: BodyArea) => equipment.includes(e.equipment) && !(avoid && e.loads.includes(avoid));

/** Exercises to swap to: the library's alternatives that suit the equipment and avoid an injured area. */
export function swapOptions(name: string, equipment: Equipment[], avoid?: BodyArea, exclude: string[] = []): ExerciseInfo[] {
  const info = findExercise(name);
  if (!info) return [];
  const listed = info.alternatives.map(findExercise).filter((e): e is ExerciseInfo => !!e);
  // Fall back to the same muscle group when the listed alternatives don't fit.
  const sameGroup = EXERCISES.filter((e) => e.muscleGroup === info.muscleGroup && e.name !== info.name);
  const seen = new Set([info.name, ...exclude]);
  return [...listed, ...sameGroup].filter((e) => !seen.has(e.name) && (seen.add(e.name), true) && usable(e, equipment, avoid));
}

/** Exercises that can be added to a workout, matching a search. */
export function addOptions(query: string, equipment: Equipment[], avoid?: BodyArea, exclude: string[] = []): ExerciseInfo[] {
  const q = query.trim().toLowerCase();
  return EXERCISES.filter(
    (e) =>
      !exclude.includes(e.name) &&
      usable(e, equipment, avoid) &&
      (q === "" || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q) || e.aliases?.some((a) => a.toLowerCase().includes(q))),
  );
}

/** A library exercise as a planned one: three working sets in a sensible rep range. */
export function plannedFromLibrary(info: ExerciseInfo, targetRpe = 8): StrengthExercise {
  return {
    name: info.name,
    warmupSets: info.isMainLift ? 1 : 0,
    workingSets: 3,
    reps: info.category === "isolation" ? "10-12" : info.isMainLift ? "5-8" : "8-10",
    targetRpe,
    failureAllowed: failureAllowed(info),
  };
}
