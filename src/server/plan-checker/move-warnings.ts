// Warnings for moving a session (SPEC decision 48). The plan checker's
// day-placement rules run on the week before and after the move; anything the
// move newly breaks is explained in plain words. The athlete can still move.
import { dayOfWeek } from "@/lib/dates";
import { DAY_NAMES, type WeekPlan } from "@/lib/domain";
import {
  consecutiveHardRuns,
  consecutiveHeavyLegs,
  doubleDay,
  fitsAvailability,
  heavyLegsNearKeyRun,
  lowerBodyAfterKeyRun,
  restDay,
  type CheckContext,
  type Rule,
  type Violation,
} from "./rules";

const PLACEMENT_RULES: Rule[] = [restDay, fitsAvailability, doubleDay, heavyLegsNearKeyRun, consecutiveHardRuns, lowerBodyAfterKeyRun, consecutiveHeavyLegs];

const day = (date?: string) => (date ? DAY_NAMES[dayOfWeek(date)] : "that day");

/** The checker's message, as something to say to the athlete. */
function explain(v: Violation): string {
  switch (v.rule) {
    case "rest-day":
      return "This leaves you no full rest day this week. Rest is when the training sinks in.";
    case "fits-availability":
      if (v.message.includes("rest day")) return `${day(v.date)} is usually a rest day for you.`;
      if (v.message.includes("double day") || v.message.includes("second slot")) return `${day(v.date)} isn't usually a day you train twice.`;
      return `This is longer than the time you usually have on ${day(v.date)}.`;
    case "double-day":
      return v.message.includes("two hard")
        ? `${day(v.date)} would have two hard sessions. That's a lot for one day.`
        : `${day(v.date)} would have two runs or two lifts. Doubles work best as one run and one lift.`;
    case "heavy-legs-near-key-run":
      return v.message.includes("same day")
        ? `Heavy leg work on ${day(v.date)} is the same day as a hard or long run, which can leave your legs tired for it.`
        : `Heavy leg work on ${day(v.date)} comes the day before a hard or long run, which can leave your legs tired for it.`;
    case "consecutive-hard-runs":
      return "This puts two hard runs on back-to-back days. A recovery day in between helps you get more from both.";
    case "lower-body-after-key-run":
      return `Leg work on ${day(v.date)} is the day after a hard or long run. Keep it lighter than usual if you can.`;
    case "consecutive-heavy-legs":
      return "This puts heavy leg sessions on back-to-back days, which makes it hard to recover between them.";
    default:
      return v.message;
  }
}

const key = (v: Violation) => `${v.rule}|${v.date ?? ""}|${v.message.includes("same day") ? "same" : ""}`;

/** Plain-English warnings for problems the move creates (ones that were already there aren't repeated). */
export function moveWarnings(before: WeekPlan, after: WeekPlan, ctx: CheckContext): string[] {
  const run = (week: WeekPlan) => PLACEMENT_RULES.flatMap((rule) => rule(week, ctx));
  const existing = new Map<string, number>();
  for (const v of run(before)) existing.set(key(v), (existing.get(key(v)) ?? 0) + 1);
  const warnings: string[] = [];
  for (const v of run(after)) {
    const k = key(v);
    const left = existing.get(k) ?? 0;
    if (left > 0) existing.set(k, left - 1);
    else warnings.push(explain(v));
  }
  return [...new Set(warnings)];
}
