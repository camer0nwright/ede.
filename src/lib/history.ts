// History and personal records (SPEC decision 52): what's been done so far,
// worked out from check-ins and logged sets. Plain code, shown on /history.
import { sessionKey, type CheckIn } from "./checkin";
import { addDays } from "./dates";
import type { SetType, WeekPlan } from "./domain";

/** A logged set from a finished workout. Weights are in kg. */
export type LiftSet = { date: string; sessionId: string; exercise: string; setType: SetType; weightKg: number | null; reps: number | null };

/** A finished run. */
export type RunDone = { date: string; minutes: number; distanceKm?: number };

/** Estimated one-rep max (Epley), so sets of different weights and reps can be compared. */
export const estimatedOneRepMax = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export type LiftRecord = {
  exercise: string;
  /** The heaviest working set (most reps at that weight breaks ties). Weight is null for bodyweight work. */
  best: { weightKg: number | null; reps: number; date: string; sessionId: string };
  /** Estimated one-rep max from the strongest set; absent for bodyweight work. */
  e1rmKg?: number;
  /** Workouts this exercise was logged in. */
  workouts: number;
};

/** Each exercise's best set and strength estimate, warm-ups left out. Strongest first. */
export function liftRecords(sets: LiftSet[]): LiftRecord[] {
  const working = sets.filter((s) => s.setType !== "warmup" && s.reps !== null && s.reps > 0);
  const byExercise = new Map<string, LiftSet[]>();
  for (const s of working) byExercise.set(s.exercise, [...(byExercise.get(s.exercise) ?? []), s]);

  const records = [...byExercise.entries()].map(([exercise, list]): LiftRecord => {
    const weighted = list.filter((s) => s.weightKg !== null && s.weightKg > 0);
    const workouts = new Set(list.map((s) => s.sessionId)).size;
    if (weighted.length === 0) {
      const best = [...list].sort((a, b) => b.reps! - a.reps! || (a.date < b.date ? -1 : 1))[0];
      return { exercise, best: { weightKg: null, reps: best.reps!, date: best.date, sessionId: best.sessionId }, workouts };
    }
    const heaviest = [...weighted].sort((a, b) => b.weightKg! - a.weightKg! || b.reps! - a.reps! || (a.date < b.date ? -1 : 1))[0];
    const e1rmKg = Math.max(...weighted.map((s) => estimatedOneRepMax(s.weightKg!, s.reps!)));
    return { exercise, best: { weightKg: heaviest.weightKg, reps: heaviest.reps!, date: heaviest.date, sessionId: heaviest.sessionId }, e1rmKg, workouts };
  });
  return records.sort((a, b) => (b.e1rmKg ?? 0) - (a.e1rmKg ?? 0) || a.exercise.localeCompare(b.exercise));
}

/** Shortest distance that counts for a fastest-pace record. */
export const PACE_RECORD_MIN_KM = 3;

/** Longest run by time, farthest by distance, and fastest pace (3 km or more). */
export function runRecords(runs: RunDone[]) {
  if (runs.length === 0) return null;
  const longest = [...runs].sort((a, b) => b.minutes - a.minutes || (a.date < b.date ? -1 : 1))[0];
  const withDistance = runs.filter((r) => r.distanceKm && r.distanceKm > 0);
  const farthest = [...withDistance].sort((a, b) => b.distanceKm! - a.distanceKm!)[0];
  const paced = withDistance.filter((r) => r.distanceKm! >= PACE_RECORD_MIN_KM).map((r) => ({ ...r, secondsPerKm: (r.minutes * 60) / r.distanceKm! }));
  const fastest = paced.sort((a, b) => a.secondsPerKm - b.secondsPerKm)[0];
  return {
    longest: { minutes: longest.minutes, date: longest.date },
    ...(farthest && { farthest: { km: farthest.distanceKm!, date: farthest.date } }),
    ...(fastest && { fastest: { secondsPerKm: fastest.secondsPerKm, km: fastest.distanceKm!, date: fastest.date } }),
  };
}

export type WeekHistory = {
  weekStart: string;
  weekNumber: number;
  phase: WeekPlan["phase"];
  sessions: number;
  done: number;
  skipped: number;
  runPlanned: number;
  runDone: number;
  distanceKm: number;
  liftedKg: number;
};

/** Each week up to this one: sessions done and skipped, running against plan, distance and weight lifted. Newest first. */
export function weekHistory(weeks: WeekPlan[], checkIns: Record<string, CheckIn>, today: string, sets: LiftSet[], runs: RunDone[]): WeekHistory[] {
  return weeks
    .filter((w) => w.weekStart <= today)
    .map((w) => {
      const end = addDays(w.weekStart, 6);
      const inWeek = (date: string) => date >= w.weekStart && date <= end;
      const status = w.sessions.map((s) => checkIns[sessionKey(s.date, s.slot)]);
      return {
        weekStart: w.weekStart,
        weekNumber: w.weekNumber,
        phase: w.phase,
        sessions: w.sessions.length,
        done: status.filter((c) => c?.status === "completed").length,
        skipped: status.filter((c) => c?.status === "skipped").length,
        runPlanned: w.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0),
        runDone: runs.filter((r) => inWeek(r.date)).reduce((sum, r) => sum + r.minutes, 0),
        distanceKm: runs.filter((r) => inWeek(r.date)).reduce((sum, r) => sum + (r.distanceKm ?? 0), 0),
        liftedKg: sets.filter((s) => inWeek(s.date) && s.setType !== "warmup").reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
      };
    })
    .reverse();
}

/**
 * Weeks in a row with at least half the sessions done, counting back from the
 * last week that's over. This week joins the streak once it reaches half.
 */
export function weekStreak(history: WeekHistory[], today: string): number {
  const counts = (w: WeekHistory) => w.sessions > 0 && w.done * 2 >= w.sessions;
  let streak = 0;
  for (const w of history) {
    const current = addDays(w.weekStart, 6) >= today;
    if (counts(w)) streak++;
    else if (!current) break;
  }
  return streak;
}

