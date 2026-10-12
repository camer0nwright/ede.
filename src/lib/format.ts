// Formatting helpers for the UI.
import { addDays, toUtc } from "./dates";
import type { Intensity, Phase } from "./domain";

/** 45 → "45 min", 90 → "1h 30", 120 → "2h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`;
}

/** Short form for tight spaces: 45 → "45m", 90 → "1h30", 120+ → "2h+" (120 means "120 or more"). */
export function formatMinutesShort(minutes: number): string {
  if (minutes >= 120) return "2h+";
  if (minutes < 60) return `${minutes}m`;
  const m = minutes % 60;
  return m === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h${m}`;
}

/** "1 double day", "2 double days". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-12" → "12 Oct". */
export function formatDay(date: string): string {
  const d = new Date(toUtc(date));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "2026-10-12" → "12 Oct 2026". */
export function formatDate(date: string): string {
  return `${formatDay(date)} ${new Date(toUtc(date)).getUTCFullYear()}`;
}

/** A Monday-to-Sunday range: "12–18 Oct", or "28 Sep – 4 Oct" across months. */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const [a, b] = [new Date(toUtc(weekStart)), new Date(toUtc(end))];
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${formatDay(weekStart)} – ${formatDay(end)}`;
}

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  recovery: "Recovery",
};

export const PHASE_COLOR: Record<Phase, string> = {
  base: "bg-phase-base",
  build: "bg-phase-build",
  peak: "bg-phase-peak",
  taper: "bg-phase-taper",
  recovery: "bg-phase-recovery",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

export const INTENSITY_COLOR: Record<Intensity, string> = {
  easy: "text-easy",
  moderate: "text-moderate",
  hard: "text-hard",
};
