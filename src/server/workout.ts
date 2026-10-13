// Loading a gym workout for the workout screen: the planned session, the sets
// logged so far, and the sets from the last time each exercise was done.
import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { exerciseToRow, fromDbDate } from "@/lib/db-mapping";
import { SetType, StrengthExercise, type BodyArea } from "@/lib/domain";
import { findExercise } from "@/lib/exercise-library";
import { holdReason, suggestNext } from "@/lib/progression";
import { equipmentFromAnswers } from "@/lib/strength-builder";
import { buildWorkout, type LoggedSet, type WeightUnit } from "@/lib/workout";
import { sessionAthleteId } from "@/server/auth";

const toLogged = (row: { setNumber: number; setType: string; weightKg: number | null; reps: number | null; rpe: number | null; exercise: { name: string } }): LoggedSet => ({
  exercise: row.exercise.name,
  setNumber: row.setNumber,
  setType: SetType.catch("working").parse(row.setType),
  weightKg: row.weightKg,
  reps: row.reps,
  rpe: row.rpe,
});

/** The signed-in athlete's session, or null if it isn't theirs (or doesn't exist). */
export async function ownSession(sessionId: string) {
  const athleteId = await sessionAthleteId();
  if (!athleteId) return null;
  const session = await db.session.findFirst({
    where: { id: sessionId, week: { athleteId } },
    include: {
      week: {
        select: {
          athleteId: true,
          phase: true,
          athlete: { select: { weightUnit: true, equipment: true, injuries: { where: { resolvedAt: null }, select: { area: true }, take: 1 } } },
        },
      },
    },
  });
  return session ? { ...session, athleteId } : null;
}

/** The library exercise's database id, adding it to the Exercise table if this is its first use. */
export async function exerciseId(name: string): Promise<string | null> {
  const found = await db.exercise.findUnique({ where: { name }, select: { id: true } });
  if (found) return found.id;
  const info = findExercise(name);
  if (!info) return null;
  const row = exerciseToRow(info);
  const created = await db.exercise.upsert({ where: { name: row.name }, create: row, update: {} });
  return created.id;
}

/** Each exercise's sets from the most recent other workout that logged it. */
async function previousSets(athleteId: string, sessionId: string, names: string[]): Promise<Record<string, LoggedSet[]>> {
  const rows = await db.setLog.findMany({
    where: { exercise: { name: { in: names } }, sessionId: { not: sessionId }, session: { week: { athleteId } } },
    include: { exercise: { select: { name: true } }, session: { select: { id: true, completedAt: true, startedAt: true } } },
    orderBy: [{ session: { startedAt: "desc" } }],
  });
  const out: Record<string, LoggedSet[]> = {};
  const latestSession: Record<string, string> = {};
  for (const row of rows) {
    const name = row.exercise.name;
    latestSession[name] ??= row.session.id;
    if (latestSession[name] === row.sessionId) (out[name] ??= []).push(toLogged(row));
  }
  return out;
}

type OwnSession = NonNullable<Awaited<ReturnType<typeof ownSession>>>;

/** The athlete's equipment, unit and any injured area, for choosing and progressing exercises. */
export function workoutSettings(session: OwnSession) {
  const athlete = session.week.athlete;
  return {
    unit: (athlete.weightUnit === "lb" ? "lb" : "kg") as WeightUnit,
    equipment: equipmentFromAnswers((athlete.equipment ?? "Full gym").split(", ")),
    avoid: athlete.injuries[0]?.area as BodyArea | undefined,
  };
}

export const plannedExercises = (session: { exercises: string | null }) => z.array(StrengthExercise).parse(JSON.parse(session.exercises ?? "[]"));

/** This time's targets from last time's sets, held back in lighter weeks or while injured. */
export function suggestionsFor(session: OwnSession, planned: StrengthExercise[], previous: Record<string, LoggedSet[]>) {
  const { unit, avoid } = workoutSettings(session);
  const hold = holdReason({ phase: session.week.phase, injuryArea: avoid, light: planned.every((e) => e.targetRpe <= 7) });
  return Object.fromEntries(planned.map((e) => [e.name, suggestNext(e, previous[e.name] ?? [], unit, hold)]));
}

/** One exercise laid out for the workout screen, with last time's sets and this time's target. */
export async function blockFor(session: OwnSession, exercise: StrengthExercise) {
  const { unit } = workoutSettings(session);
  const previous = await previousSets(session.athleteId, session.id, [exercise.name]);
  return buildWorkout([exercise], [], previous, unit, suggestionsFor(session, [exercise], previous))[0];
}

export async function loadWorkout(sessionId: string) {
  const session = await ownSession(sessionId);
  if (!session || session.type !== "strength") return null;
  const planned = plannedExercises(session);
  const logs = await db.setLog.findMany({ where: { sessionId }, include: { exercise: { select: { name: true } } } });
  const logged = logs.map(toLogged);
  const previous = await previousSets(session.athleteId, sessionId, planned.map((e) => e.name));
  const settings = workoutSettings(session);
  return {
    equipment: settings.equipment,
    avoid: settings.avoid,
    suggestions: suggestionsFor(session, planned, previous),
    id: session.id,
    title: session.title,
    date: fromDbDate(session.date),
    status: session.status,
    startedAt: session.startedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    actualMinutes: session.actualMinutes,
    effort: session.effort,
    planned,
    logged,
    previous,
    unit: settings.unit,
  };
}
export type Workout = NonNullable<Awaited<ReturnType<typeof loadWorkout>>>;
