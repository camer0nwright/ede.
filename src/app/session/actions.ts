"use server";

import { z } from "zod";
import { CheckInInput, checkInCaution } from "@/lib/checkin";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { sessionToRow, toDbDate, weekToRow } from "@/lib/db-mapping";
import { IsoDate } from "@/lib/domain";
import { builtWeeks, getPlanContext, type PlanContext } from "@/server/athlete";

export type CheckInResult = { ok: true; caution: string | null } | { ok: false; errors: string[] };

const KM_PER_MILE = 1.609344;

/**
 * The database id of a planned session, saving its week first if it hasn't
 * been yet (weeks are built on the fly until something in them is checked in,
 * then kept exactly as they were).
 */
async function storedSessionId(ctx: PlanContext & { athleteId: string }, date: string, slot: number): Promise<string | null> {
  const built = builtWeeks(ctx).find((b) => b.week.weekStart <= date && date <= addDays(b.week.weekStart, 6));
  if (!built || !built.week.sessions.some((s) => s.date === date && s.slot === slot)) return null;
  const weekStart = toDbDate(built.week.weekStart);

  const find = () =>
    db.session.findFirst({ where: { date: toDbDate(date), slot, week: { athleteId: ctx.athleteId, weekStart } }, select: { id: true } });
  const existing = await find();
  if (existing) return existing.id;
  try {
    await db.planWeek.create({
      data: { athleteId: ctx.athleteId, ...weekToRow(built.week), sessions: { create: built.week.sessions.map(sessionToRow) } },
    });
  } catch {
    // Saved meanwhile by another check-in (the week is unique per athlete): use that one.
  }
  return (await find())?.id ?? null;
}

async function signedInContext() {
  const ctx = await getPlanContext();
  return ctx.isDemo || !ctx.athleteId ? null : (ctx as PlanContext & { athleteId: string });
}

/** Marks a session done (time, effort, notes, distance for runs) or skipped with a reason. */
export async function checkIn(raw: unknown): Promise<CheckInResult> {
  const parsed = CheckInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const c = parsed.data;
  const ctx = await signedInContext();
  if (!ctx) return { ok: false, errors: ["Set up your own plan to check in sessions."] };
  if (c.status === "completed" && c.date > ctx.today) return { ok: false, errors: ["You can mark a session done on the day or after it."] };

  try {
    const id = await storedSessionId(ctx, c.date, c.slot);
    if (!id) return { ok: false, errors: ["That session isn't in your plan any more. Refresh and try again."] };
    const notes = c.notes || null;
    if (c.status === "completed") {
      const session = await db.session.update({
        where: { id },
        data: { status: "completed", completedAt: new Date(), actualMinutes: c.actualMinutes, effort: c.effort, notes, skipReason: null },
      });
      if (session.type === "run") {
        const distanceKm = c.distance === undefined ? null : ctx.paces.unit === "mi" ? c.distance * KM_PER_MILE : c.distance;
        const log = { distanceKm, durationSeconds: c.actualMinutes * 60 };
        await db.runLog.upsert({ where: { sessionId: id }, create: { sessionId: id, ...log }, update: log });
      }
    } else {
      await db.session.update({
        where: { id },
        data: { status: "skipped", completedAt: null, actualMinutes: null, effort: null, notes, skipReason: c.skipReason },
      });
      await db.runLog.deleteMany({ where: { sessionId: id } });
    }
  } catch (e) {
    console.error("Check-in failed", e);
    return { ok: false, errors: ["That couldn't be saved just now. Try again in a moment."] };
  }
  return { ok: true, caution: checkInCaution(c.notes) };
}

const Where = z.object({ date: IsoDate, slot: z.union([z.literal(1), z.literal(2)]) });

/** Puts a checked-in session back to planned. */
export async function undoCheckIn(raw: unknown): Promise<CheckInResult> {
  const parsed = Where.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["Something went wrong. Try again."] };
  const ctx = await signedInContext();
  if (!ctx) return { ok: false, errors: ["Set up your own plan to check in sessions."] };
  try {
    const session = await db.session.findFirst({
      where: { date: toDbDate(parsed.data.date), slot: parsed.data.slot, week: { athleteId: ctx.athleteId } },
      select: { id: true },
    });
    if (session) {
      await db.runLog.deleteMany({ where: { sessionId: session.id } });
      await db.session.update({
        where: { id: session.id },
        data: { status: "planned", completedAt: null, actualMinutes: null, effort: null, notes: null, skipReason: null },
      });
    }
  } catch (e) {
    console.error("Undoing a check-in failed", e);
    return { ok: false, errors: ["That couldn't be undone just now. Try again in a moment."] };
  }
  return { ok: true, caution: null };
}
