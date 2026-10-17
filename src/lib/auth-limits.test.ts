import { describe, expect, it } from "vitest";
import { LIMITS, newPasswordProblem, passwordProblem, tryAgainIn, waitSeconds } from "./auth-limits";

const now = new Date("2026-10-16T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

describe("log-in limits", () => {
  it("allows tries until the limit, then says how long to wait", () => {
    const four = [1, 2, 3, 4].map(minutesAgo);
    expect(waitSeconds(four, now, LIMITS.emailFailures)).toBeNull();
    const five = [1, 2, 3, 4, 10].map(minutesAgo);
    // The oldest of the five leaves the 15-minute window in 5 minutes.
    expect(waitSeconds(five, now, LIMITS.emailFailures)).toBe(300);
    expect(tryAgainIn(300)).toBe("Try again in 5 minutes.");
    expect(tryAgainIn(30)).toBe("Try again in 1 minute.");
  });

  it("forgets tries older than the window", () => {
    const old = [16, 20, 30, 40, 50].map(minutesAgo);
    expect(waitSeconds(old, now, LIMITS.emailFailures)).toBeNull();
  });

  it("counts more failures from one network before blocking", () => {
    const many = Array.from({ length: 19 }, (_, i) => minutesAgo(i / 2));
    expect(waitSeconds(many, now, LIMITS.networkFailures)).toBeNull();
    expect(waitSeconds([...many, minutesAgo(0)], now, LIMITS.networkFailures)).toBeGreaterThan(0);
  });
});

describe("password strength", () => {
  it("refuses the most common passwords, repeated characters and the email name", () => {
    expect(passwordProblem("Password123", "cam@example.com")).toMatch(/most common/);
    expect(passwordProblem("aaaaaaaa", "cam@example.com")).toMatch(/repeated/);
    expect(passwordProblem("connie2026!", "connie@example.com")).toMatch(/email/);
    expect(passwordProblem("long run sundays", "cam@example.com")).toBeNull();
  });
});

describe("changing password", () => {
  it("needs a new password that's different", () => {
    expect(newPasswordProblem("trail-runner-42", "trail-runner-42", "cam@example.com")).toMatch(/different/);
  });

  it("applies the same rules as sign-up", () => {
    expect(newPasswordProblem("trail-runner-42", "short", "cam@example.com")).toMatch(/8 characters/);
    expect(newPasswordProblem("trail-runner-42", "password123", "cam@example.com")).toMatch(/most common/);
    expect(newPasswordProblem("trail-runner-42", "cameron-lifts", "cameron@example.com")).toMatch(/email/);
  });

  it("accepts a sound new password", () => {
    expect(newPasswordProblem("trail-runner-42", "hill-reps-at-dawn", "cam@example.com")).toBeNull();
  });
});
