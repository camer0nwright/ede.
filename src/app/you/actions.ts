"use server";

import { redirect } from "next/navigation";
import { athleteToDraft, isSection, toAnswers } from "@/components/onboarding/draft";
import { db } from "@/lib/db";
import { answersToAthleteRow, sessionToRow, toDbDate, weekToRow } from "@/lib/db-mapping";
import { OnboardingAnswers, targetDateProblem, toOutlineInput } from "@/lib/onboarding";
import type { OutlineInput, PlanOutline } from "@/lib/plan-outline";
import { continuityFromWeeks, rebuildOutline, rebuildStart } from "@/lib/plan-rebuild";
import { mergeSection } from "@/lib/plan-settings";
import { builtWeeks, getPlanContext, getSavedAthlete } from "@/server/athlete";

export type SaveResult = { ok: false; errors: string[] };

/**
 * Saves one edited section of the plan settings and rebuilds the plan from
 * next Monday (SPEC decision 41). This week and earlier are saved as they are,
 * so they don't change under you. Only the edited section's answers are taken
 * from the browser; the rest come from what's saved.
 */
export async function updatePlanSettings(section: string, raw: unknown): Promise<SaveResult> {
  if (!isSection(section) || typeof raw !== "object" || raw === null) return { ok: false, errors: ["Something went wrong. Try again."] };
  const [loaded, ctx] = await Promise.all([getSavedAthlete(), getPlanContext()]);
  if (!loaded || ctx.isDemo) return { ok: false, errors: ["Set up your own plan first."] };

  const merged = mergeSection(toAnswers(athleteToDraft(loaded.saved)), raw as Record<string, unknown>, section);
  const parsed = OnboardingAnswers.safeParse(merged);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const a = parsed.data;

  const today = ctx.today;
  if (section === "goal" && a.targetDate) {
    const problem = targetDateProblem(a.targetDate, today);
    if (problem) return { ok: false, errors: [problem] };
  }

  // Rebuild from next Monday (or the plan's own start if it hasn't begun),
  // carrying on from the last full week of running so far.
  const start = rebuildStart(today, ctx.input.startDate);
  const kept = builtWeeks(ctx)
    .map((b) => b.week)
    .filter((w) => w.weekStart < start);
  const continuity = kept.length > 0 ? continuityFromWeeks(kept) : {};
  const fresh = { ...toOutlineInput(a, today), ...continuity, startDate: start };
  let outline: PlanOutline;
  try {
    outline = rebuildOutline(ctx.outline, fresh, start);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "Couldn't build a plan from those settings."] };
  }
  // The saved input keeps the plan's own start and starting load.
  const input: OutlineInput = {
    ...fresh,
    startDate: ctx.input.startDate,
    lastWeekRunMinutes: ctx.input.lastWeekRunMinutes,
    longestRecentRunMinutes: ctx.input.longestRecentRunMinutes,
  };
  const alreadyStored = new Set(ctx.storedWeeks.map((w) => w.weekStart));

  try {
    await db.$transaction(async (tx) => {
      const id = loaded.id;
      await tx.athlete.update({ where: { id }, data: answersToAthleteRow(a, input) });
      if (section === "week") {
        await tx.availabilityDay.deleteMany({ where: { athleteId: id } });
        await tx.availabilityDay.createMany({ data: a.availability.map((d, dayOfWeek) => ({ athleteId: id, dayOfWeek, ...d })) });
      }
      await tx.planOutline.updateMany({ where: { athleteId: id, active: true }, data: { active: false } });
      const created = await tx.planOutline.create({ data: { athleteId: id, input: JSON.stringify(input), outline: JSON.stringify(outline) } });
      await tx.planWeek.deleteMany({ where: { athleteId: id, weekStart: { gte: toDbDate(start) } } });
      for (const week of kept) {
        if (alreadyStored.has(week.weekStart)) continue;
        await tx.planWeek.create({
          data: { athleteId: id, outlineId: created.id, ...weekToRow(week), sessions: { create: week.sessions.map(sessionToRow) } },
        });
      }
    });
  } catch (e) {
    console.error("Saving plan settings failed", e);
    return { ok: false, errors: ["Your changes couldn't be saved just now. Try again in a moment."] };
  }
  redirect("/you?saved=1");
}
