// Remembered exercise swaps (SPEC decision 77): after swapping an exercise in
// a workout, the athlete can keep the swap, and future sessions use their
// choice instead. Plain code, applied wherever sessions are shown or started.
import type { BodyArea, Equipment, StrengthExercise, WeekPlan } from "./domain";
import { failureAllowed, findExercise, type ExerciseInfo } from "./exercise-library";
import { usable } from "./progression";

/** Kept swaps: the exercise the plan gives → the one the athlete uses instead. */
export type Swaps = Record<string, string>;

type Fit = { equipment: Equipment[]; avoid?: BodyArea };

/**
 * What to do instead of `name`: follows kept swaps (Y instead of X, then Z
 * instead of Y) to the last one that suits the equipment and any injury.
 * Undefined when there's no kept swap that fits.
 */
export function swapTarget(name: string, swaps: Swaps, fit: Fit): ExerciseInfo | undefined {
  let found: ExerciseInfo | undefined;
  const seen = new Set([name]);
  for (let next = swaps[name]; next && !seen.has(next); next = swaps[next]) {
    seen.add(next);
    const info = findExercise(next);
    if (info && usable(info, fit.equipment, fit.avoid)) found = info;
  }
  return found;
}

/** A session's exercises with kept swaps in place; never the same exercise twice. */
export function applySwaps(exercises: StrengthExercise[], swaps: Swaps, fit: Fit): StrengthExercise[] {
  if (Object.keys(swaps).length === 0) return exercises;
  const names = new Set(exercises.map((e) => e.name));
  return exercises.map((e) => {
    const target = swapTarget(e.name, swaps, fit);
    if (!target || names.has(target.name)) return e;
    names.add(target.name);
    return { ...e, name: target.name, failureAllowed: e.failureAllowed && failureAllowed(target) };
  });
}

/**
 * Weeks with kept swaps in the gym sessions still to come: from `from` on,
 * leaving out any session `started` says has a workout already. Past
 * sessions keep what was planned.
 */
export function applySwapsToWeeks(weeks: WeekPlan[], swaps: Swaps, fit: Fit & { from: string; started: (date: string, slot: number) => boolean }): WeekPlan[] {
  if (Object.keys(swaps).length === 0) return weeks;
  return weeks.map((w) => ({
    ...w,
    sessions: w.sessions.map((s) =>
      s.type === "strength" && s.date >= fit.from && !fit.started(s.date, s.slot) ? { ...s, exercises: applySwaps(s.exercises, swaps, fit) } : s,
    ),
  }));
}
