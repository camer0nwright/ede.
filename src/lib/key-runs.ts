// Which runs are long runs and key runs (SPEC decisions 3 and 5). Shared by
// the plan checker and the week builder, so they always agree.

/** A run counts as a long run from this many minutes. */
export const LONG_RUN_MIN_MINUTES = 60;

type Run = { minutes: number; day: number; hard: boolean };

/**
 * Long runs: the week's longest run if it's 60+ minutes, plus any 60+ minute
 * run the day before or after it (the other half of a back-to-back).
 */
export function longRunFlags(runs: Run[]): boolean[] {
  const longest = Math.max(0, ...runs.map((r) => r.minutes));
  if (longest < LONG_RUN_MIN_MINUTES) return runs.map(() => false);
  const anchorDays = runs.filter((r) => r.minutes === longest).map((r) => r.day);
  return runs.map(
    (r) =>
      r.minutes === longest ||
      (r.minutes >= LONG_RUN_MIN_MINUTES && anchorDays.some((d) => Math.abs(d - r.day) === 1)),
  );
}

/** Key runs: hard runs and long runs. */
export function keyRunFlags(runs: Run[]): boolean[] {
  const long = longRunFlags(runs);
  return runs.map((r, i) => r.hard || long[i]);
}
