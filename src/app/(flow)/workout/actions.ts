"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { toKg } from "@/lib/db-mapping";
import { IsoDate, SetType, type StrengthExercise } from "@/lib/domain";
import { failureAllowed, findExercise } from "@/lib/exercise-library";
import { addOptions, plannedFromLibrary, swapOptions } from "@/lib/progression";
import { applySwaps } from "@/lib/swaps";
import type { ExerciseBlock } from "@/lib/workout";
import { signedInContext, storedSessionId } from "@/server/sessions";
import { blockFor, exerciseId, ownSession, plannedExercises, workoutSettings } from "@/server/workout";

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
  const session = await db.session.findUniqueOrThrow({ where: { id }, select: { status: true, type: true, exercises: true } });
  if (session.type !== "strength") return fail("Only gym sessions have a workout screen.");
  if (session.status === "planned") {
    // A week saved before a swap was kept still has the old exercise: use the athlete's choice (SPEC decision 77).
    const planned = JSON.parse(session.exercises ?? "[]") as StrengthExercise[];
    const exercises = applySwaps(planned, ctx.swaps, { equipment: ctx.build.equipment, avoid: ctx.build.avoid });
    await db.session.update({ where: { id }, data: { status: "in_progress", startedAt: new Date(), exercises: JSON.stringify(exercises) } });
  }
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

export type ExerciseResult = { ok: true; block?: ExerciseBlock; askToKeep?: boolean } | { ok: false; errors: string[] };

async function changeExercises(
  raw: unknown,
  shape: z.ZodType<{ sessionId: string }>,
  change: (args: { session: NonNullable<Awaited<ReturnType<typeof workoutInProgress>>>; planned: StrengthExercise[] }) => Promise<
    { planned: StrengthExercise[]; added?: StrengthExercise; askToKeep?: boolean } | string
  >,
): Promise<ExerciseResult> {
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["Something went wrong. Try again."] };
  const session = await workoutInProgress(parsed.data.sessionId);
  if (!session) return { ok: false, errors: ["This workout isn't in progress any more."] };
  const result = await change({ session, planned: plannedExercises(session) });
  if (typeof result === "string") return { ok: false, errors: [result] };
  await db.session.update({ where: { id: session.id }, data: { exercises: JSON.stringify(result.planned) } });
  return { ok: true, ...(result.added && { block: await blockFor(session, result.added) }), ...(result.askToKeep && { askToKeep: true }) };
}

const loggedFor = (sessionId: string, name: string) => db.setLog.count({ where: { sessionId, exercise: { name } } });

/** Swaps an exercise (nothing logged for it yet) for an alternative that suits the athlete's equipment and injuries. */
export async function swapExercise(raw: unknown): Promise<ExerciseResult> {
  const shape = z.object({ sessionId: z.string().min(1), from: z.string().min(1), to: z.string().min(1) });
  return changeExercises(raw, shape, async ({ session, planned }) => {
    const { from, to } = shape.parse(raw);
    const index = planned.findIndex((e) => e.name === from);
    if (index < 0) return "That exercise isn't in this workout.";
    if (await loggedFor(session.id, from)) return `Untick the ${from.toLowerCase()} sets first, then swap it.`;
    const { equipment, avoid } = workoutSettings(session);
    const choice = swapOptions(from, equipment, avoid, planned.map((e) => e.name)).find((e) => e.name === to);
    if (!choice) return `${to} isn't a swap that suits your equipment.`;
    const swapped = { ...planned[index], name: choice.name, failureAllowed: planned[index].failureAllowed && failureAllowed(choice) };
    // Ask "from now on?" once per pair (SPEC decision 77).
    const answered = await db.exerciseSwap.count({ where: { athleteId: session.week.athleteId, fromName: from, toName: choice.name } });
    return { planned: planned.map((e, i) => (i === index ? swapped : e)), added: swapped, askToKeep: answered === 0 };
  });
}

const SwapAnswer = z.object({ from: z.string().min(1).max(100), to: z.string().min(1).max(100), keep: z.boolean() });

/**
 * Answers "Use X instead of Y from now on?" (SPEC decision 77). Yes: future
 * gym sessions use X, replacing any earlier choice for Y. Just today: ede.
 * doesn't ask again for this pair.
 */
export async function answerSwap(raw: unknown): Promise<WorkoutResult> {
  const parsed = SwapAnswer.safeParse(raw);
  if (!parsed.success) return fail("Something went wrong. Try again.");
  const ctx = await signedInContext();
  if (!ctx) return fail("Set up your own plan to keep swaps.");
  const { from, to, keep } = parsed.data;
  const fromInfo = findExercise(from);
  const toInfo = findExercise(to);
  if (!fromInfo || !toInfo || fromInfo.name === toInfo.name) return fail("Those exercises aren't in the library.");
  const athleteId = ctx.athleteId;
  await db.$transaction([
    ...(keep ? [db.exerciseSwap.deleteMany({ where: { athleteId, fromName: fromInfo.name, keep: true } })] : []),
    db.exerciseSwap.upsert({
      where: { athleteId_fromName_toName: { athleteId, fromName: fromInfo.name, toName: toInfo.name } },
      create: { athleteId, fromName: fromInfo.name, toName: toInfo.name, keep },
      update: { keep },
    }),
  ]);
  return { ok: true };
}

/** Stops using a kept swap (from You): the plan's own exercise comes back in future sessions. */
export async function forgetSwap(raw: unknown): Promise<WorkoutResult> {
  const parsed = z.object({ from: z.string().min(1).max(100) }).safeParse(raw);
  if (!parsed.success) return fail("Something went wrong. Try again.");
  const ctx = await signedInContext();
  if (!ctx) return fail("Set up your own plan to change swaps.");
  await db.exerciseSwap.deleteMany({ where: { athleteId: ctx.athleteId, fromName: parsed.data.from, keep: true } });
  return { ok: true };
}

/** Adds a library exercise to the end of the workout. */
export async function addExercise(raw: unknown): Promise<ExerciseResult> {
  const shape = z.object({ sessionId: z.string().min(1), name: z.string().min(1) });
  return changeExercises(raw, shape, async ({ session, planned }) => {
    const { name } = shape.parse(raw);
    const { equipment, avoid } = workoutSettings(session);
    const choice = addOptions("", equipment, avoid, planned.map((e) => e.name)).find((e) => e.name === name);
    if (!choice) return `${name} can't be added with your equipment.`;
    const added = plannedFromLibrary(choice);
    return { planned: [...planned, added], added };
  });
}

/** Removes an exercise that has nothing logged yet. */
export async function removeExercise(raw: unknown): Promise<ExerciseResult> {
  const shape = z.object({ sessionId: z.string().min(1), name: z.string().min(1) });
  return changeExercises(raw, shape, async ({ session, planned }) => {
    const { name } = shape.parse(raw);
    if (!planned.some((e) => e.name === name)) return "That exercise isn't in this workout.";
    if (await loggedFor(session.id, name)) return `Untick the ${name.toLowerCase()} sets first, then remove it.`;
    if (planned.length === 1) return "A workout needs at least one exercise. Discard the workout instead.";
    return { planned: planned.filter((e) => e.name !== name) };
  });
}
