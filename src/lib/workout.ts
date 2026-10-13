// Gym logging (SPEC: Gym sessions and logging): the planned sets laid out for
// the workout screen, what was logged last time next to each set, and the
// finish summary. Weights are stored in kg and shown in the athlete's unit.
import { fromKg } from "./db-mapping";
import type { SetType, StrengthExercise } from "./domain";
import { defaultRestSeconds, findExercise } from "./exercise-library";

export type WeightUnit = "kg" | "lb";

/** A set as logged (one SetLog row). */
export type LoggedSet = { exercise: string; setNumber: number; setType: SetType; weightKg: number | null; reps: number | null; rpe: number | null };

/** One row on the workout screen. Weight, reps and RPE are as typed, in the athlete's unit. */
export type SetRow = {
  setNumber: number;
  setType: SetType;
  plannedReps?: string;
  plannedRpe?: number;
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  /** Last time's numbers for the matching set, if any. */
  previous?: { weight: string; reps: number };
  /** Reps to aim for this time (from progression). */
  targetReps?: number;
};

/** This time's target from progression (src/lib/progression.ts). */
export type BlockSuggestion = { weight?: string; reps: number; note: string };

export type ExerciseBlock = {
  name: string;
  restSeconds: number;
  failureAllowed: boolean;
  isMainLift: boolean;
  sets: SetRow[];
  suggestion?: BlockSuggestion;
};

/** A weight for display: kg to the nearest 0.25, lb to the nearest 0.5, without trailing zeros. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = fromKg(kg, unit);
  const step = unit === "kg" ? 4 : 2;
  return String(Math.round(value * step) / step);
}

const isWarmup = (t: SetType) => t === "warmup";

/**
 * The workout screen's exercises: the plan's warm-up and working sets, with
 * anything already logged filled in (plus extra sets that were added), and
 * last time's numbers matched set by set (warm-ups to warm-ups, working sets
 * to working sets, in order).
 */
export function buildWorkout(
  planned: StrengthExercise[],
  logged: LoggedSet[],
  previous: Record<string, LoggedSet[]>,
  unit: WeightUnit,
  suggestions: Record<string, BlockSuggestion | undefined> = {},
): ExerciseBlock[] {
  return planned.map((e) => {
    const info = findExercise(e.name);
    const rows: SetRow[] = [
      ...Array.from({ length: e.warmupSets }, (_, i): SetRow => ({ setNumber: i + 1, setType: "warmup", weight: "", reps: "", rpe: "", done: false })),
      ...Array.from({ length: e.workingSets }, (_, i): SetRow => ({
        setNumber: e.warmupSets + i + 1,
        setType: "working",
        plannedReps: e.reps,
        plannedRpe: e.targetRpe,
        weight: "",
        reps: "",
        rpe: "",
        done: false,
      })),
    ];
    for (const log of logged.filter((l) => l.exercise === e.name).sort((a, b) => a.setNumber - b.setNumber)) {
      const filled: Partial<SetRow> = {
        setType: log.setType,
        weight: log.weightKg === null ? "" : formatWeight(log.weightKg, unit),
        reps: log.reps === null ? "" : String(log.reps),
        rpe: log.rpe === null ? "" : String(log.rpe),
        done: true,
      };
      const row = rows.find((r) => r.setNumber === log.setNumber);
      if (row) Object.assign(row, filled);
      else rows.push({ setNumber: log.setNumber, weight: "", reps: "", rpe: "", setType: log.setType, done: true, ...filled });
    }

    const before = (previous[e.name] ?? []).filter((p) => p.weightKg !== null && p.reps !== null).sort((a, b) => a.setNumber - b.setNumber);
    const lastWarmups = before.filter((p) => isWarmup(p.setType));
    const lastWorking = before.filter((p) => !isWarmup(p.setType));
    let w = 0;
    let k = 0;
    for (const row of rows) {
      const match = isWarmup(row.setType) ? lastWarmups[w++] : lastWorking[k++];
      if (match) row.previous = { weight: formatWeight(match.weightKg!, unit), reps: match.reps! };
    }

    // Progression pre-fills this time's weight and target reps on working sets not yet logged.
    const suggestion = suggestions[e.name];
    if (suggestion) {
      for (const row of rows) {
        if (row.setType !== "working" || row.done) continue;
        row.targetReps = suggestion.reps;
        if (suggestion.weight) row.weight = suggestion.weight;
      }
    }

    return {
      name: e.name,
      ...(suggestion && { suggestion }),
      restSeconds: info ? defaultRestSeconds(info) : 90,
      failureAllowed: e.failureAllowed,
      isMainLift: info?.isMainLift ?? false,
      sets: rows,
    };
  });
}

/** The heaviest working set (most reps at that weight breaks ties). */
function bestSet(sets: LoggedSet[]) {
  return sets
    .filter((s) => !isWarmup(s.setType) && s.weightKg !== null && s.reps !== null && s.reps > 0)
    .sort((a, b) => b.weightKg! - a.weightKg! || b.reps! - a.reps!)[0];
}

/** The finish screen: sets done, total weight lifted, and what beat last time. */
export function workoutSummary(logged: LoggedSet[], previous: Record<string, LoggedSet[]>, unit: WeightUnit) {
  const working = logged.filter((s) => !isWarmup(s.setType));
  const volumeKg = working.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const improvements: { exercise: string; text: string }[] = [];
  for (const exercise of [...new Set(logged.map((s) => s.exercise))]) {
    const now = bestSet(logged.filter((s) => s.exercise === exercise));
    const then = bestSet(previous[exercise] ?? []);
    if (!now || !then) continue;
    if (now.weightKg! > then.weightKg!) {
      improvements.push({ exercise, text: `+${formatWeight(now.weightKg! - then.weightKg!, unit)} ${unit}` });
    } else if (now.weightKg === then.weightKg && now.reps! > then.reps!) {
      improvements.push({ exercise, text: `+${now.reps! - then.reps!} reps at ${formatWeight(now.weightKg!, unit)} ${unit}` });
    }
  }
  return { sets: logged.length, workingSets: working.length, volume: formatWeight(volumeKg, unit), improvements };
}
