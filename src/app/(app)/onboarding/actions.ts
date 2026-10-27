"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { answersToAthleteRow, toDbDate } from "@/lib/db-mapping";
import { healthConsentProblem, OnboardingAnswers, targetDateProblem, toOutlineInput } from "@/lib/onboarding";
import { UNSAVED_PLAN_DAYS } from "@/lib/legal";
import { buildPlanOutline } from "@/lib/plan-outline";
import { ATHLETE_COOKIE } from "@/server/athlete";
import { newPendingToken, sessionAthleteId } from "@/server/auth";

export type SaveResult = { ok: false; errors: string[] };

/**
 * Saves onboarding answers and builds the athlete's plan outline. Answers are
 * validated again here: never trust what the browser sends. Signed in, the new
 * plan replaces the account's plan. Otherwise the plan is kept for this device
 * and the next step is creating the account (SPEC decision 45).
 */
export async function saveOnboarding(raw: unknown): Promise<SaveResult> {
  const parsed = OnboardingAnswers.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const a = parsed.data;

  const consent = healthConsentProblem(a);
  if (consent) return { ok: false, errors: [consent] };

  const today = new Date().toISOString().slice(0, 10);
  if (a.targetDate) {
    const problem = targetDateProblem(a.targetDate, today);
    if (problem) return { ok: false, errors: [problem] };
  }

  const input = toOutlineInput(a, today);
  let outline;
  try {
    outline = buildPlanOutline(input);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "Couldn't build a plan from those answers."] };
  }

  const profile = {
    name: a.name || null,
    ...answersToAthleteRow(a, input),
    currentTraining: a.currentTraining || null,
    lastWeekRunMinutes: a.lastWeekRunMinutes,
    longestRecentRunMinutes: a.longestRecentRunMinutes,
    injuryHistory: a.injuryHistory || null,
    ...((a.injury || a.injuryHistory) && { healthConsentAt: new Date() }),
    weightUnit: a.weightUnit,
    distanceUnit: a.distanceUnit,
  };
  const injury = a.injury && { area: a.injury.area, painLevel: a.injury.painLevel, painWhen: a.injury.painWhen, notes: a.injury.notes || null };

  const signedIn = await sessionAthleteId();
  if (signedIn) {
    try {
      await db.$transaction(async (tx) => {
        await tx.athlete.update({ where: { id: signedIn }, data: profile });
        await tx.availabilityDay.deleteMany({ where: { athleteId: signedIn } });
        await tx.availabilityDay.createMany({ data: a.availability.map((d, dayOfWeek) => ({ athleteId: signedIn, dayOfWeek, ...d })) });
        await tx.planOutline.updateMany({ where: { athleteId: signedIn, active: true }, data: { active: false } });
        await tx.planOutline.create({ data: { athleteId: signedIn, input: JSON.stringify(input), outline: JSON.stringify(outline) } });
        // Weeks from the old plan that are under way or done stay as history.
        await tx.planWeek.deleteMany({ where: { athleteId: signedIn, weekStart: { gte: toDbDate(input.startDate) } } });
        const active = await tx.injury.count({ where: { athleteId: signedIn, resolvedAt: null } });
        if (injury && active === 0) await tx.injury.create({ data: { ...injury, athleteId: signedIn } });
      });
    } catch (e) {
      console.error("Saving a new plan failed", e);
      return { ok: false, errors: ["Your plan couldn't be saved just now. Your answers are still here, so try again in a moment."] };
    }
    redirect("/plan");
  }

  // Plans set up but never saved to an account are deleted after a while (SPEC decision 57).
  await db.athlete
    .deleteMany({ where: { email: null, createdAt: { lt: new Date(Date.now() - UNSAVED_PLAN_DAYS * 24 * 60 * 60 * 1000) } } })
    .catch((e) => console.error("Removing old unsaved plans failed", e));

  const pending = newPendingToken();
  try {
    await db.athlete.create({
      data: {
        ...profile,
        pendingTokenHash: pending.hash,
        availability: { create: a.availability.map((d, dayOfWeek) => ({ dayOfWeek, ...d })) },
        ...(injury && { injuries: { create: injury } }),
        outlines: { create: { input: JSON.stringify(input), outline: JSON.stringify(outline) } },
      },
    });
  } catch (e) {
    // Don't show database details to the user; log them for debugging.
    console.error("Saving onboarding failed", e);
    return { ok: false, errors: ["Your plan couldn't be saved just now. Your answers are still here, so try again in a moment."] };
  }

  (await cookies()).set(ATHLETE_COOKIE, pending.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * UNSAVED_PLAN_DAYS,
    path: "/",
  });
  redirect("/signup");
}

/** Forgets a plan on this device that no account has claimed, so the demo shows again. */
export async function resetToDemo() {
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/");
}
