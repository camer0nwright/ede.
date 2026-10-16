// Log-in protection rules (SPEC decision 54): how many failed log-ins or
// sign-ups are allowed in a time window, how long until the next try, and which
// passwords are too easy to guess. Plain code; the server records attempts.

export type Limit = { max: number; windowMinutes: number };

export const LIMITS = {
  /** Wrong passwords for one email address. */
  emailFailures: { max: 5, windowMinutes: 15 },
  /** Failed log-ins from one network, across any accounts. */
  networkFailures: { max: 20, windowMinutes: 15 },
  /** New accounts from one network. */
  signups: { max: 10, windowMinutes: 60 },
} satisfies Record<string, Limit>;

/**
 * Seconds until another try is allowed, or null if one is allowed now. A
 * sliding window: once there are `max` attempts in the last `windowMinutes`,
 * the next is allowed when the oldest of those leaves the window.
 */
export function waitSeconds(attempts: Date[], now: Date, limit: Limit): number | null {
  const windowMs = limit.windowMinutes * 60 * 1000;
  const recent = attempts.filter((a) => now.getTime() - a.getTime() < windowMs).sort((a, b) => b.getTime() - a.getTime());
  if (recent.length < limit.max) return null;
  const freesUp = recent[limit.max - 1].getTime() + windowMs;
  return Math.max(1, Math.ceil((freesUp - now.getTime()) / 1000));
}

/** "Try again in 12 minutes." */
export function tryAgainIn(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return `Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/** Passwords people pick most often: refused because they're guessed first. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890", "87654321", "11111111",
  "00000000", "qwerty123", "qwertyuiop", "qwerty12", "1q2w3e4r", "1qaz2wsx", "abc12345", "abcd1234", "iloveyou", "letmein1",
  "welcome1", "welcome123", "sunshine", "princess", "football", "baseball", "superman", "trustno1", "dragon12", "monkey12",
  "changeme", "admin123", "starwars", "whatever", "freedom1", "running1", "marathon", "fitness1", "training", "gymlife1",
]);

/** Why a new password is too easy to guess, or null if it's fine. */
export function passwordProblem(password: string, email: string): string | null {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is one of the most common, so it's easy to guess. Choose another.";
  if (/^(.)\1+$/.test(password)) return "Use more than one repeated character in your password.";
  const name = email.split("@")[0]?.toLowerCase() ?? "";
  if (name.length >= 4 && lower.includes(name)) return "Don't use your email address in your password.";
  return null;
}
