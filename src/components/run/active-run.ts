"use client";

// The run being recorded (SPEC decision 82). It lives here rather than in the
// recorder screen, so GPS keeps going when you leave that screen, and it's
// kept on the phone so closing the app doesn't lose it.
import { watchGps, type GpsError } from "@/lib/native-gps";
import { TRACK_CONFIG, type Pause, type TrackPoint } from "@/lib/run-track";

export type Recording = { startedAt: number; points: TrackPoint[]; pauses: Pause[]; pausedAt?: number; endedAt?: number };
export type GpsState = "off" | "searching" | "ok" | GpsError;

const PREFIX = "ede-run:";

/** Runs are keyed by session id ("2026-10-29-1"), which is also the recorder's address. */
export const runHref = (id: string) => `/run/${id}`;

// Read from storage once per run, so each read hands back the same object until it changes.
const cache = new Map<string, Recording | null>();
let gps: { id: string; state: GpsState; stop: Promise<(() => Promise<void>) | null> } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function getRun(id: string): Recording | null {
  if (cache.has(id)) return cache.get(id)!;
  let rec: Recording | null = null;
  try {
    const raw = localStorage.getItem(PREFIX + id);
    rec = raw ? (JSON.parse(raw) as Recording) : null;
  } catch {
    // No storage or a damaged entry: nothing to resume.
  }
  cache.set(id, rec);
  return rec;
}

export function setRun(id: string, rec: Recording | null) {
  cache.set(id, rec);
  try {
    if (rec) localStorage.setItem(PREFIX + id, JSON.stringify(rec));
    else localStorage.removeItem(PREFIX + id);
  } catch {
    // Private mode or full storage: the run still records, it just won't survive closing the app.
  }
  notify();
}

/** Runs on this phone that were started and not yet saved or discarded. */
export function savedRuns(): { id: string; finished: boolean }[] {
  const runs: { id: string; finished: boolean }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) runs.push({ id: key.slice(PREFIX.length), finished: !!getRun(key.slice(PREFIX.length))?.endedAt });
    }
  } catch {
    // No storage: no runs.
  }
  return runs;
}

export const gpsState = (id: string): GpsState => (gps?.id === id ? gps.state : "off");

function setGps(state: GpsState) {
  if (gps) gps.state = state;
  notify();
}

/** Starts GPS for this run, if it isn't going already. Points are added until the run finishes. */
export function startGps(id: string) {
  if (gps?.id === id) return;
  void stopGps();
  const stop = watchGps(
    (p) => {
      const r = getRun(id);
      if (!r || r.endedAt) return;
      if (gps?.id === id && p.acc <= TRACK_CONFIG.maxAccuracyM) gps.state = "ok";
      setRun(id, { ...r, points: [...r.points, p] });
    },
    (e) => setGps(e),
  ).catch(() => {
    setGps("unavailable");
    return null;
  });
  gps = { id, state: "searching", stop };
  notify();
}

export async function stopGps() {
  const current = gps;
  gps = null;
  notify();
  const stop = await current?.stop;
  await stop?.().catch(() => {});
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
