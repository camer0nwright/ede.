"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { athleteToDraft, isSection, toAnswers } from "@/components/onboarding/draft";
import { db } from "@/lib/db";
import { answersToAthleteRow } from "@/lib/db-mapping";
import { daysBetween } from "@/lib/dates";
import { Injury } from "@/lib/domain";
import { injuryBand } from "@/lib/injury";
import { OnboardingAnswers, targetDateProblem, toOutlineInput } from "@/lib/onboarding";
import { continuityFromWeeks, returnFromInjury } from "@/lib/plan-rebuild";
import { mergeSection } from "@/lib/plan-settings";
import { ATHLETE_COOKIE, builtWeeks, getPlanContext, getSavedAthlete } from "@/server/athlete";
import { SESSION_COOKIE } from "@/server/auth";
import { saveRebuiltPlan } from "@/server/plan-save";

export type ActionResult = { ok: false; errors: string[] };

const NOT_SET_UP: ActionResult = { ok: false, errors: ["Set up your own plan first."] };

/**
 * Saves one edited section of the plan settings and rebuilds the plan from
 * next Monday (SPEC decision 41). Only the edited section's answers are taken
 * from the browser; the rest come from what's saved.
 */
export async function updatePlanSettings(section: string, raw: unknown): Promise<ActionResult> {
  if (!isSection(section) || typeof raw !== "object" || raw === null) return { ok: false, errors: ["Something went wrong. Try again."] };
  const [loaded, ctx] = await Promise.all([getSavedAthlete(), getPlanContext()]);
  if (!loaded || ctx.isDemo) return NOT_SET_UP;

  const merged = mergeSection(toAnswers(athleteToDraft(loaded.saved)), raw as Record<string, unknown>, section);
  const parsed = OnboardingAnswers.safeParse(merged);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const a = parsed.data;
  if (section === "goal" && a.targetDate) {
    const problem = targetDateProblem(a.targetDate, ctx.today);
    if (problem) return { ok: false, errors: [problem] };
  }

  const input = toOutlineInput(a, ctx.today);
  const result = await saveRebuiltPlan(ctx, {
    athleteId: loaded.id,
    input,
    alsoSave: async (tx) => {
      await tx.athlete.update({ where: { id: loaded.id }, data: answersToAthleteRow(a, input) });
      if (section === "week") {
        await tx.availabilityDay.deleteMany({ where: { athleteId: loaded.id } });
        await tx.availabilityDay.createMany({ data: a.availability.map((d, dayOfWeek) => ({ athleteId: loaded.id, dayOfWeek, ...d })) });
      }
    },
  });
  if (!result.ok) return result;
  redirect("/you?saved=1");
}

const InjuryReport = Injury.extend({ notes: z.string().trim().max(500).optional() });

/**
 * Reports an injury, or updates the one that's active. The plan adapts from
 * today: nothing is rebuilt, so marking it better later restores the plan.
 */
export async function saveInjury(raw: unknown): Promise<ActionResult> {
  const parsed = InjuryReport.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const ctx = await getPlanContext();
  if (ctx.isDemo || !ctx.athleteId) return NOT_SET_UP;
  const data = { ...parsed.data, notes: parsed.data.notes || null };
  try {
    if (ctx.injury) await db.injury.update({ where: { id: ctx.injury.id }, data });
    else await db.injury.create({ data: { ...data, athleteId: ctx.athleteId } });
  } catch (e) {
    console.error("Saving an injury failed", e);
    return { ok: false, errors: ["That couldn't be saved just now. Try again in a moment."] };
  }
  redirect(`/you?injury=${ctx.injury ? "updated" : "reported"}`);
}

/**
 * Marks the active injury better and rebuilds the plan from next Monday with a
 * gentle return (SPEC decision 42): less load the longer you were out, and
 * more if easy running carried on.
 */
export async function markInjuryBetter(): Promise<ActionResult> {
  const ctx = await getPlanContext();
  if (ctx.isDemo || !ctx.athleteId) return NOT_SET_UP;
  const injury = ctx.injury;
  if (!injury) redirect("/you");

  const before = continuityFromWeeks(builtWeeks(ctx).filter((b) => !b.injured && b.week.weekStart < injury.since).map((b) => b.week));
  const weeksOut = Math.max(1, Math.ceil(daysBetween(injury.since, ctx.today) / 7));
  const back = returnFromInjury(
    {
      lastWeekRunMinutes: before.lastWeekRunMinutes ?? ctx.input.lastWeekRunMinutes ?? 0,
      longestRecentRunMinutes: before.longestRecentRunMinutes ?? ctx.input.longestRecentRunMinutes ?? 0,
    },
    weeksOut,
    injuryBand(injury) === "mild",
  );
  const athleteId = ctx.athleteId;
  const result = await saveRebuiltPlan(ctx, {
    athleteId,
    input: ctx.input,
    continuity: back,
    returning: true,
    alsoSave: (tx) => tx.injury.update({ where: { id: injury.id }, data: { resolvedAt: new Date() } }),
  });
  if (!result.ok) return result;
  redirect("/you?injury=better");
}

const AccountSettings = z.object({
  name: z.string().trim().min(1, "Tell us what to call you").max(60),
  weightUnit: z.enum(["kg", "lb"]),
  distanceUnit: z.enum(["km", "mi"]),
});

/** Saves the name and units. Nothing about the plan changes, so there's no rebuild. */
export async function updateAccount(raw: unknown): Promise<ActionResult | { ok: true }> {
  const parsed = AccountSettings.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const ctx = await getPlanContext();
  if (ctx.isDemo || !ctx.athleteId) return NOT_SET_UP;
  try {
    await db.athlete.update({ where: { id: ctx.athleteId }, data: parsed.data });
  } catch (e) {
    console.error("Saving account settings failed", e);
    return { ok: false, errors: ["That couldn't be saved just now. Try again in a moment."] };
  }
  return { ok: true };
}

/**
 * Deletes everything ede. holds about this athlete: account, sign-ins,
 * profile, plans, weeks, sessions, logs, injuries and coach messages (all
 * cascade from the athlete), then signs this device out.
 */
export async function deleteMyData(): Promise<ActionResult> {
  const ctx = await getPlanContext();
  if (ctx.isDemo || !ctx.athleteId) return NOT_SET_UP;
  try {
    await db.athlete.delete({ where: { id: ctx.athleteId } });
  } catch (e) {
    console.error("Deleting athlete data failed", e);
    return { ok: false, errors: ["Your data couldn't be deleted just now. Try again in a moment."] };
  }
  const jar = await cookies();
  jar.delete(ATHLETE_COOKIE);
  jar.delete(SESSION_COOKIE);
  redirect("/?deleted=1");
}
