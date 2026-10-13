// Formatting helpers for the UI.
import { addDays, dayOfWeek, toUtc } from "./dates";
import { DAY_NAMES, openEndedMinutes, type Intensity, type Phase } from "./domain";

/** 45 → "45 min", 90 → "1h 30", 120 → "2h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`;
}

/** Short form for tight spaces: 45 → "45m", 90 → "1h30", 180 → "3h". */
export function formatMinutesShort(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const m = minutes % 60;
  return m === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h${m}`;
}

/** A day's available time: the top option reads "2h+" (or "6h+" for ultras). */
export function formatDayMinutes(minutes: number, ultra = false): string {
  return minutes >= openEndedMinutes(ultra) ? `${formatMinutesShort(openEndedMinutes(ultra))}+` : formatMinutesShort(minutes);
}

/** A race time: 1350 → "22:30", 6600 → "1:50:00". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.round(seconds % 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
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
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-20" → "Tuesday 20 October". */
export function formatLongDate(date: string): string {
  const d = new Date(toUtc(date));
  return `${DAY_NAMES[dayOfWeek(date)]} ${d.getUTCDate()} ${FULL_MONTHS[d.getUTCMonth()]}`;
}

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
