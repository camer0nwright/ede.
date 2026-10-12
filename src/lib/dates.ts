// Date helpers for YYYY-MM-DD strings. Everything is done in UTC so a user's
// time zone can never shift a session onto a different day.
const DAY_MS = 24 * 60 * 60 * 1000;

export function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Monday ... 6 = Sunday. */
export function dayOfWeek(date: string): number {
  return (new Date(toUtc(date)).getUTCDay() + 6) % 7;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}
