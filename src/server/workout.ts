// Loading a gym workout for the workout screen: the planned session, the sets
// logged so far, and the sets from the last time each exercise was done.
import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { exerciseToRow, fromDbDate } from "@/lib/db-mapping";
import { SetType, StrengthExercise } from "@/lib/domain";
import { findExercise } from "@/lib/exercise-library";
import type { LoggedSet, WeightUnit } from "@/lib/workout";
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
    include: { week: { select: { athleteId: true, athlete: { select: { weightUnit: true } } } } },
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

export async function loadWorkout(sessionId: string) {
  const session = await ownSession(sessionId);
  if (!session || session.type !== "strength") return null;
  const planned = z.array(StrengthExercise).parse(JSON.parse(session.exercises ?? "[]"));
  const logs = await db.setLog.findMany({ where: { sessionId }, include: { exercise: { select: { name: true } } } });
  const logged = logs.map(toLogged);
  const previous = await previousSets(session.athleteId, sessionId, planned.map((e) => e.name));
  return {
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
    unit: (session.week.athlete.weightUnit === "lb" ? "lb" : "kg") as WeightUnit,
  };
}
export type Workout = NonNullable<Awaited<ReturnType<typeof loadWorkout>>>;
