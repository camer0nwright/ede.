// Recording a run with GPS in the iPhone app (SPEC decision 82): which points
// to keep, how far and how long the run was, and which planned step it's on.
// The same code runs in the app (live numbers) and on the server (what's saved).
import { z } from "zod";

/** One GPS fix: degrees, milliseconds since the epoch, accuracy and altitude in metres. */
export const TrackPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().positive(),
  acc: z.number().min(0),
  alt: z.number().nullable().optional(),
});
export type TrackPoint = z.infer<typeof TrackPoint>;

/** A pause, from when it was pressed to when the run resumed (or finished). */
export const Pause = z.object({ from: z.number().int().positive(), to: z.number().int().positive() });
export type Pause = z.infer<typeof Pause>;

export const TRACK_CONFIG = {
  /** Fixes less accurate than this are ignored. */
  maxAccuracyM: 30,
  /** Faster than this between two fixes is a GPS jump, not running (about 2:05/km). */
  maxSpeedMps: 8,
  /** Moves shorter than this are GPS wobble while standing still. */
  minMoveM: 3,
  /** At most this many points are saved for one run (about 4 hours at a fix every 2 seconds). */
  maxPoints: 8000,
};

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two points on the Earth's surface. */
export function distanceM(a: Pick<TrackPoint, "lat" | "lng">, b: Pick<TrackPoint, "lat" | "lng">): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const pausedAt = (t: number, pauses: Pause[]) => pauses.some((p) => t >= p.from && t < p.to);

/**
 * Whether a new fix should be kept after the last kept one: accurate enough,
 * later in time, not while paused, far enough to be real movement and not so
 * far that it must be a GPS jump.
 */
export function keepPoint(last: TrackPoint | undefined, p: TrackPoint, pauses: Pause[] = []): boolean {
  if (p.acc > TRACK_CONFIG.maxAccuracyM || pausedAt(p.t, pauses)) return false;
  if (!last) return true;
  if (p.t <= last.t) return false;
  const metres = distanceM(last, p);
  if (metres < TRACK_CONFIG.minMoveM) return false;
  // Coming back from a pause, the first fix starts a new stretch: never counted as a jump.
  if (pauses.some((x) => last.t < x.to && p.t >= x.to)) return true;
  return metres / ((p.t - last.t) / 1000) <= TRACK_CONFIG.maxSpeedMps;
}

/** The points worth keeping, in time order. */
export function cleanTrack(points: TrackPoint[], pauses: Pause[] = []): TrackPoint[] {
  const kept: TrackPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) if (keepPoint(kept.at(-1), p, pauses)) kept.push(p);
  return kept;
}

export type RunSummary = {
  distanceKm: number;
  /** Time running: from start to finish, less pauses. */
  movingSeconds: number;
  /** Seconds per km over the moving time, or null before any distance. */
  paceSecondsPerKm: number | null;
};

/** Time between two moments that wasn't paused. */
export function movingMs(from: number, to: number, pauses: Pause[]): number {
  const paused = pauses.reduce((sum, p) => sum + Math.max(0, Math.min(p.to, to) - Math.max(p.from, from)), 0);
  return Math.max(0, to - from - paused);
}

/**
 * Distance, moving time and pace. Distance joins kept points, but not across a
 * pause (walking to a crossing while paused doesn't count).
 */
export function summarise(points: TrackPoint[], startedAt: number, endedAt: number, pauses: Pause[] = []): RunSummary {
  const kept = cleanTrack(points, pauses);
  let metres = 0;
  for (let i = 1; i < kept.length; i++) {
    const crossesPause = pauses.some((p) => kept[i - 1].t < p.to && kept[i].t >= p.from);
    if (!crossesPause) metres += distanceM(kept[i - 1], kept[i]);
  }
  const movingSeconds = Math.round(movingMs(startedAt, endedAt, pauses) / 1000);
  const distanceKm = metres / 1000;
  return { distanceKm, movingSeconds, paceSecondsPerKm: distanceKm >= 0.05 ? movingSeconds / distanceKm : null };
}

/** Which planned step a run is on after this many moving seconds, and how long is left of it. */
export function currentStep(steps: { minutes: number }[], movingSeconds: number): { index: number; secondsLeft: number } | null {
  let end = 0;
  for (let i = 0; i < steps.length; i++) {
    end += steps[i].minutes * 60;
    if (movingSeconds < end) return { index: i, secondsLeft: Math.ceil(end - movingSeconds) };
  }
  return null;
}

/** "5:24" per km or mile, from seconds per km. */
export function formatPace(secondsPerKm: number | null, unit: "km" | "mi" = "km"): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "–:––";
  const s = Math.round(unit === "mi" ? secondsPerKm * 1.609344 : secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "1:02:05" or "42:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = `${String(s % 60).padStart(2, "0")}`;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

/** The route as saved: kept points only, rounded to about a metre, capped in number. */
export function routeToSave(points: TrackPoint[], pauses: Pause[] = []): TrackPoint[] {
  const kept = cleanTrack(points, pauses);
  const step = Math.ceil(kept.length / TRACK_CONFIG.maxPoints);
  return kept
    .filter((_, i) => i % step === 0 || i === kept.length - 1)
    .map((p) => ({ lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), t: p.t, acc: Math.round(p.acc), ...(p.alt != null && { alt: Math.round(p.alt) }) }));
}
