"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { toKg } from "@/lib/db-mapping";
import { IsoDate, SetType } from "@/lib/domain";
import { signedInContext, storedSessionId } from "@/server/sessions";
import { exerciseId, ownSession } from "@/server/workout";

export type WorkoutResult = { ok: true } | { ok: false; errors: string[] };
const fail = (message: string): WorkoutResult => ({ ok: false, errors: [message] });

/** Starts (or resumes) a planned gym session and opens the workout screen. */
export async function startWorkout(raw: unknown): Promise<WorkoutResult> {
  const parsed = z.object({ date: IsoDate, slot: z.union([z.literal(1), z.literal(2)]) }).safeParse(raw);
  if (!parsed.success) return fail("Something went wrong. Try again.");
  const ctx = await signedInContext();
  if (!ctx) return fail("Set up your own plan to log workouts.");
  if (parsed.data.date > ctx.today) return fail("You can start a workout on the day.");

  const id = await storedSessionId(ctx, parsed.data.date, parsed.data.slot);
  if (!id) return fail("That session isn't in your plan any more. Refresh and try again.");
  const session = await db.session.findUniqueOrThrow({ where: { id }, select: { status: true, type: true } });
  if (session.type !== "strength") return fail("Only gym sessions have a workout screen.");
  if (session.status === "planned") await db.session.update({ where: { id }, data: { status: "in_progress", startedAt: new Date() } });
  redirect(`/workout/${id}`);
}

const SetInput = z.object({
  sessionId: z.string().min(1),
  exercise: z.string().min(1).max(100),
  setNumber: z.number().int().min(1).max(50),
  setType: SetType,
  plannedReps: z.string().max(20).optional(),
  plannedRpe: z.number().min(1).max(10).optional(),
  /** In the athlete's unit. */
  weight: z.number().min(0).max(2000).optional(),
  reps: z.number().int().min(0).max(1000).optional(),
  rpe: z.number().min(1).max(10).multipleOf(0.5).optional(),
});

async function workoutInProgress(sessionId: string) {
  const session = await ownSession(sessionId);
  if (!session) return null;
  return session.status === "in_progress" ? session : null;
}

/** Saves a ticked set straight away, so nothing is lost if the page closes. */
export async function logSet(raw: unknown): Promise<WorkoutResult> {
  const parsed = SetInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the numbers and try again.");
  const s = parsed.data;
  const session = await workoutInProgress(s.sessionId);
  if (!session) return fail("This workout isn't in progress any more.");
  const exercise = await exerciseId(s.exercise);
  if (!exercise) return fail(`${s.exercise} isn't in the exercise library.`);
  const unit = session.week.athlete.weightUnit === "lb" ? "lb" : "kg";
  const data = {
    setType: s.setType,
    plannedReps: s.plannedReps ?? null,
    plannedRpe: s.plannedRpe ?? null,
    weightKg: s.weight === undefined ? null : toKg(s.weight, unit),
    reps: s.reps ?? null,
    rpe: s.rpe ?? null,
    completedAt: new Date(),
  };
  try {
    await db.setLog.upsert({
      where: { sessionId_exerciseId_setNumber: { sessionId: s.sessionId, exerciseId: exercise, setNumber: s.setNumber } },
      create: { sessionId: s.sessionId, exerciseId: exercise, setNumber: s.setNumber, ...data },
      update: data,
    });
  } catch (e) {
    console.error("Logging a set failed", e);
    return fail("That set couldn't be saved. Check your connection and tick it again.");
  }
  return { ok: true };
}

/** Unticks a set (removes its log). */
export async function unlogSet(raw: unknown): Promise<WorkoutResult> {
  const parsed = SetInput.pick({ sessionId: true, exercise: true, setNumber: true }).safeParse(raw);
  if (!parsed.success) return fail("Something went wrong. Try again.");
  const session = await workoutInProgress(parsed.data.sessionId);
  if (!session) return fail("This workout isn't in progress any more.");
  await db.setLog.deleteMany({ where: { sessionId: parsed.data.sessionId, setNumber: parsed.data.setNumber, exercise: { name: parsed.data.exercise } } });
  return { ok: true };
}

/** Finishes the workout: the session is done, with its time from start to finish. */
export async function finishWorkout(raw: unknown): Promise<WorkoutResult> {
  const parsed = z
    .object({ sessionId: z.string().min(1), effort: z.number().int().min(1).max(10), notes: z.string().trim().max(1000).optional() })
    .safeParse(raw);
  if (!parsed.success) return fail("Pick how hard the workout felt, from 1 to 10.");
  const session = await workoutInProgress(parsed.data.sessionId);
  if (!session) return fail("This workout isn't in progress any more.");
  const now = new Date();
  const minutes = session.startedAt ? Math.max(1, Math.round((now.getTime() - session.startedAt.getTime()) / 60000)) : session.plannedMinutes;
  await db.session.update({
    where: { id: session.id },
    data: { status: "completed", completedAt: now, actualMinutes: Math.min(minutes, 600), effort: parsed.data.effort, notes: parsed.data.notes || null },
  });
  redirect(`/workout/${session.id}`);
}

/** Throws the workout away: logged sets are deleted and the session is planned again. */
export async function discardWorkout(raw: unknown): Promise<WorkoutResult> {
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return fail("Something went wrong. Try again.");
  const session = await workoutInProgress(parsed.data.sessionId);
  if (!session) return fail("This workout isn't in progress any more.");
  await db.setLog.deleteMany({ where: { sessionId: session.id } });
  await db.session.update({ where: { id: session.id }, data: { status: "planned", startedAt: null } });
  redirect("/");
}
