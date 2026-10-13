"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { toDbDate } from "@/lib/db-mapping";
import { OnboardingAnswers, targetDateProblem, toOutlineInput } from "@/lib/onboarding";
import { buildPlanOutline } from "@/lib/plan-outline";
import { ATHLETE_COOKIE } from "@/server/athlete";

export type SaveResult = { ok: false; errors: string[] };

/**
 * Saves onboarding answers and builds the athlete's plan outline. Answers are
 * validated again here: never trust what the browser sends.
 */
export async function saveOnboarding(raw: unknown): Promise<SaveResult> {
  const parsed = OnboardingAnswers.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const a = parsed.data;

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

  let athlete;
  try {
    athlete = await db.athlete.create({
      data: {
        name: a.name || null,
        goalType: a.goalType,
        goalDetail: a.goalDetail || null,
        targetDate: input.targetDate ? toDbDate(input.targetDate) : null,
        raceDistance: input.raceDistance ?? null,
        ultraDistanceKm: input.ultraDistanceKm ?? null,
        elevationGainM: a.elevationGainM ?? null,
        terrain: input.terrain ?? null,
        experienceLevel: a.experienceLevel,
        strengthVolume: a.strengthVolume,
        currentTraining: a.currentTraining || null,
        lastWeekRunMinutes: a.lastWeekRunMinutes,
        longestRecentRunMinutes: a.longestRecentRunMinutes,
        recent5kMinutes: a.recent5kSeconds ? a.recent5kSeconds / 60 : null,
        targetTimeSeconds: a.goalType === "race" && !a.justFinish ? (a.targetTimeSeconds ?? null) : null,
        justFinish: a.goalType === "race" && (a.justFinish ?? false),
        runsPerWeek: a.runsPerWeek,
        liftsPerWeek: a.liftsPerWeek,
        equipment: a.equipment.join(", "),
        injuryHistory: a.injuryHistory || null,
        weightUnit: a.weightUnit,
        distanceUnit: a.distanceUnit,
        availability: { create: a.availability.map((d, dayOfWeek) => ({ dayOfWeek, ...d })) },
        ...(a.injury && {
          injuries: { create: { area: a.injury.area, painLevel: a.injury.painLevel, painWhen: a.injury.painWhen, notes: a.injury.notes || null } },
        }),
        outlines: { create: { input: JSON.stringify(input), outline: JSON.stringify(outline) } },
      },
    });
  } catch (e) {
    // Don't show database details to the user; log them for debugging.
    console.error("Saving onboarding failed", e);
    return { ok: false, errors: ["Your plan couldn't be saved just now. Your answers are still here, so try again in a moment."] };
  }

  (await cookies()).set(ATHLETE_COOKIE, athlete.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  redirect("/plan");
}

/** Forgets the current athlete on this device, so the demo shows again. */
export async function resetToDemo() {
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/");
}
