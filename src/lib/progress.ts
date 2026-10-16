// Progress charts (SPEC decision 55): running and lifting week by week, and how
// each lift has moved. Plain code that shapes history into chart points.
import { estimatedOneRepMax, type LiftSet, type WeekHistory } from "./history";

/** Weeks shown on the weekly charts. */
export const CHART_WEEKS = 12;

export type WeekPoint = { weekStart: string; weekNumber: number; runDone: number; runPlanned: number; distanceKm: number; liftedKg: number };

/** The last few weeks, oldest first, for the running and lifting charts. */
export function weeklySeries(history: WeekHistory[], weeks = CHART_WEEKS): WeekPoint[] {
  return history
    .slice(0, weeks)
    .reverse()
    .map(({ weekStart, weekNumber, runDone, runPlanned, distanceKm, liftedKg }) => ({ weekStart, weekNumber, runDone, runPlanned, distanceKm, liftedKg }));
}

export type LiftPoint = {
  date: string;
  sessionId: string;
  /** Estimated one-rep max from the workout's strongest set; absent for bodyweight work. */
  e1rmKg?: number;
  /** The workout's strongest set (most reps for bodyweight work). */
  best: { weightKg: number | null; reps: number };
};

export type LiftSeries = { exercise: string; weighted: boolean; points: LiftPoint[] };

/**
 * Each exercise's workouts in date order, with the strongest set from each.
 * Weighted exercises are measured by estimated max, bodyweight ones by reps.
 * Most-logged exercises first.
 */
export function liftSeries(sets: LiftSet[]): LiftSeries[] {
  const working = sets.filter((s) => s.setType !== "warmup" && s.reps !== null && s.reps > 0);
  const byExercise = new Map<string, Map<string, LiftSet[]>>();
  for (const s of working) {
    const sessions = byExercise.get(s.exercise) ?? new Map<string, LiftSet[]>();
    sessions.set(s.sessionId, [...(sessions.get(s.sessionId) ?? []), s]);
    byExercise.set(s.exercise, sessions);
  }

  const series = [...byExercise.entries()].map(([exercise, sessions]): LiftSeries => {
    const weighted = [...sessions.values()].some((list) => list.some((s) => s.weightKg !== null && s.weightKg > 0));
    const points = [...sessions.entries()]
      .map(([sessionId, list]): LiftPoint | null => {
        const date = list[0].date;
        if (!weighted) {
          const reps = Math.max(...list.map((s) => s.reps!));
          return { date, sessionId, best: { weightKg: null, reps } };
        }
        const loaded = list.filter((s) => s.weightKg !== null && s.weightKg > 0);
        if (loaded.length === 0) return null;
        const best = loaded.reduce((a, b) => (estimatedOneRepMax(b.weightKg!, b.reps!) > estimatedOneRepMax(a.weightKg!, a.reps!) ? b : a));
        return { date, sessionId, e1rmKg: estimatedOneRepMax(best.weightKg!, best.reps!), best: { weightKg: best.weightKg, reps: best.reps! } };
      })
      .filter((p): p is LiftPoint => p !== null)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { exercise, weighted, points };
  });
  return series.sort((a, b) => b.points.length - a.points.length || a.exercise.localeCompare(b.exercise));
}

/** The value a lift chart plots: estimated max (kg) for weighted work, reps for bodyweight. */
export const liftValue = (p: LiftPoint) => p.e1rmKg ?? p.best.reps;

/** Change from the first workout to the latest, or null with fewer than two. */
export function liftChange(series: LiftSeries): number | null {
  if (series.points.length < 2) return null;
  return liftValue(series.points.at(-1)!) - liftValue(series.points[0]);
}

/**
 * A tidy axis: a top value at or above `max` built from 1, 2, 2.5 or 5 steps,
 * and the gridline values from zero. An empty chart still gets a scale.
 */
export function niceScale(max: number, ticks = 4): { top: number; values: number[] } {
  if (!(max > 0)) return { top: ticks, values: Array.from({ length: ticks + 1 }, (_, i) => i) };
  const rough = max / ticks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
  const top = Math.ceil(max / step - 1e-9) * step;
  const values: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) values.push(Number(v.toFixed(6)));
  return { top: values.at(-1)!, values };
}

/** A lift axis that doesn't start at zero, so progress shows: the data's range with some room above and below. */
export function rangeScale(min: number, max: number, ticks = 3): { bottom: number; top: number; values: number[] } {
  const span = Math.max(max - min, Math.abs(max) * 0.1, 1);
  const low = Math.max(0, min - span * 0.25);
  const high = max + span * 0.25;
  const rough = (high - low) / ticks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
  const bottom = Math.floor(low / step) * step;
  const values: number[] = [];
  for (let v = bottom; v < high + step - 1e-9; v += step) values.push(Number(v.toFixed(6)));
  return { bottom, top: values.at(-1)!, values };
}

/** A time axis in steps a runner reads easily: 15 or 30 minutes, then whole hours. */
export function minuteScale(max: number, ticks = 4): { top: number; values: number[] } {
  const step = [15, 30, 60, 120, 180, 240].find((s) => s * ticks >= max) ?? Math.ceil(max / ticks / 60) * 60;
  const count = Math.max(1, Math.ceil(max / step - 1e-9));
  return { top: count * step, values: Array.from({ length: count + 1 }, (_, i) => i * step) };
}
