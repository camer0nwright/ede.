// Pace guides from a recent 5K time (SPEC decision 40). Race predictions use
// Riegel's formula, T2 = T1 × (D2 / D1)^1.06, which is usually within a few
// percent for trained runners (less for newer runners, hilly courses, or
// distances far from 5K). Training paces are bands around 5K pace, close to
// the zones used in common VDOT-style tables. Effort (RPE) stays the main
// target; paces are a guide.
import type { RaceDistance } from "./domain";

export const RACE_KM: Record<Exclude<RaceDistance, "ultra">, number> = { "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };
const KM_PER_MILE = 1.609344;

/** Riegel's prediction for a race distance from a 5K time, in seconds. */
export function predictRaceSeconds(fiveKSeconds: number, distanceKm: number): number {
  return fiveKSeconds * (distanceKm / 5) ** 1.06;
}

export type PaceBand = { name: string; fromSecPerKm: number; toSecPerKm: number };

/**
 * Training pace bands by effort, as multiples of 5K pace (slower = higher):
 * easy RPE 1-4, steady RPE 5-6, tempo RPE 7, 10K-ish RPE 8, 5K-ish RPE 9-10.
 */
const BANDS: { maxRpe: number; name: string; from: number; to: number }[] = [
  { maxRpe: 2, name: "Very easy", from: 1.35, to: 1.55 },
  { maxRpe: 4, name: "Easy", from: 1.22, to: 1.38 },
  { maxRpe: 6, name: "Steady", from: 1.12, to: 1.18 },
  { maxRpe: 7, name: "Tempo", from: 1.06, to: 1.1 },
  { maxRpe: 8, name: "10K effort", from: 1.02, to: 1.05 },
  { maxRpe: 10, name: "5K effort", from: 0.97, to: 1.0 },
];

/** The pace band for an effort level, from a 5K time. */
export function paceForRpe(fiveKSeconds: number, rpe: number): PaceBand {
  const pace = fiveKSeconds / 5;
  const band = BANDS.find((b) => rpe <= b.maxRpe) ?? BANDS.at(-1)!;
  return { name: band.name, fromSecPerKm: pace * band.from, toSecPerKm: pace * band.to };
}

/** "5:20" from seconds. */
const mmss = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A pace band as text: "5:10-5:25/km" or "8:19-8:43/mi" (faster first). */
export function formatPaceBand(band: PaceBand, unit: "km" | "mi"): string {
  const f = unit === "km" ? 1 : KM_PER_MILE;
  return `${mmss(band.fromSecPerKm * f)}-${mmss(band.toSecPerKm * f)}/${unit}`;
}

/** One pace as text: "5:00/km" or "8:03/mi". */
export function formatPace(secondsPerKm: number, unit: "km" | "mi"): string {
  return `${mmss(secondsPerKm * (unit === "km" ? 1 : KM_PER_MILE))}/${unit}`;
}

/** A distance in the athlete's unit: "8.2 km" or "5.1 mi". */
export function formatDistance(km: number, unit: "km" | "mi"): string {
  return `${(unit === "km" ? km : km / KM_PER_MILE).toFixed(1)} ${unit}`;
}

/**
 * Compares a desired race time with what a 5K predicts. Returns a gentle
 * note when the desired time is clearly faster than predicted, else null.
 */
export function desiredVsPredicted(distance: RaceDistance | undefined, desiredSeconds: number | undefined, fiveKSeconds: number | undefined): string | null {
  if (!distance || distance === "ultra" || !desiredSeconds || !fiveKSeconds) return null;
  const predicted = predictRaceSeconds(fiveKSeconds, RACE_KM[distance]);
  if (desiredSeconds < predicted * 0.95) {
    const h = Math.floor(predicted / 3600);
    const text = h > 0 ? `${h}:${mmss(predicted % 3600).padStart(5, "0")}` : mmss(predicted);
    return `Your 5K suggests about ${text} today. Your target is ambitious, which is fine: the plan builds towards it, and check-ins will show whether to adjust.`;
  }
  return null;
}
