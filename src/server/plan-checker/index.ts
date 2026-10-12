// The plan checker: plain code that validates an AI-generated week against
// ede.'s fixed training rules. Runs on the server only.
import "server-only";
import { WeekPlan } from "@/lib/domain";
import { ALL_RULES, type CheckContext, type Violation } from "./rules";

export type { CheckContext, PastWeek, RuleId, Violation } from "./rules";
export { CHECKER_CONFIG } from "./config";

export type CheckResult =
  | { ok: true; week: WeekPlan; violations: [] }
  | { ok: false; week?: WeekPlan; violations: Violation[] };

/**
 * Checks raw AI output. First the shape is validated, then every rule runs.
 * On failure, `violations` lists every problem so the AI can fix them all at once.
 */
export function checkWeekPlan(raw: unknown, ctx: CheckContext): CheckResult {
  const parsed = WeekPlan.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      violations: parsed.error.issues.map((i) => ({
        rule: "week-structure",
        message: `Invalid plan format at ${i.path.join(".") || "root"}: ${i.message}`,
      })),
    };
  }
  const week = parsed.data;
  const violations = ALL_RULES.flatMap((rule) => rule(week, ctx));
  return violations.length === 0
    ? { ok: true, week, violations: [] }
    : { ok: false, week, violations };
}

/** Formats violations as a short list to send back to the AI for a retry. */
export function describeViolations(violations: Violation[]): string {
  return violations.map((v) => `- [${v.rule}] ${v.message}`).join("\n");
}
