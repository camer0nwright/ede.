"use server";

import { z } from "zod";
import { CheckInInput, checkInCaution, sessionKey } from "@/lib/checkin";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { toDbDate } from "@/lib/db-mapping";
import { IsoDate } from "@/lib/domain";
import { planMove } from "@/lib/move";
import { builtWeeks } from "@/server/athlete";
import { moveWarnings } from "@/server/plan-checker/move-warnings";
import { signedInContext, storedSessionId } from "@/server/sessions";

export type CheckInResult = { ok: true; caution: string | null } | { ok: false; errors: string[] };

const KM_PER_MILE = 1.609344;


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
      await db.setLog.deleteMany({ where: { sessionId: session.id } });
      await db.session.update({
        where: { id: session.id },
        data: { status: "planned", startedAt: null, completedAt: null, actualMinutes: null, effort: null, notes: null, skipReason: null },
      });
    }
  } catch (e) {
    console.error("Undoing a check-in failed", e);
    return { ok: false, errors: ["That couldn't be undone just now. Try again in a moment."] };
  }
  return { ok: true, caution: null };
}

const MoveInput = z.object({
  date: IsoDate,
  slot: z.union([z.literal(1), z.literal(2)]),
  to: IsoDate,
  mode: z.enum(["move", "swap", "both"]),
  /** Move even though it breaks a training rule (the athlete saw the warnings). */
  confirm: z.boolean().default(false),
});

export type MoveResult = { ok: true; moved: boolean; warnings: string[] } | { ok: false; errors: string[] };

/**
 * Moves a session to another day of its week (SPEC decision 48). Problems the
 * move would cause come back as warnings first; with `confirm` it moves anyway.
 */
export async function moveSession(raw: unknown): Promise<MoveResult> {
  const parsed = MoveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["Something went wrong. Try again."] };
  const m = parsed.data;
  const ctx = await signedInContext();
  if (!ctx) return { ok: false, errors: ["Set up your own plan to move sessions."] };

  const built = builtWeeks(ctx).find((b) => b.week.weekStart <= m.date && m.date <= addDays(b.week.weekStart, 6));
  if (!built) return { ok: false, errors: ["That session isn't in your plan any more. Refresh and try again."] };
  const week = built.week;
  if (m.to < week.weekStart || m.to > addDays(week.weekStart, 6)) return { ok: false, errors: ["Sessions can move within their own week."] };
  if (m.to < ctx.today) return { ok: false, errors: ["Pick today or a later day."] };

  const locked = (s: { date: string; slot: number }) => !!ctx.checkIns[sessionKey(s.date, s.slot)] || !!ctx.workouts[sessionKey(s.date, s.slot)];
  if (locked(m)) return { ok: false, errors: ["Sessions that are done, skipped or started can't be moved."] };
  if (m.mode === "swap" && week.sessions.some((s) => s.date === m.to && locked(s))) {
    return { ok: false, errors: ["The session on that day is already done or started, so it can't swap."] };
  }

  let plan: ReturnType<typeof planMove>;
  try {
    plan = planMove(week, m, m.to, m.mode);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "That move isn't possible."] };
  }
  const warnings = moveWarnings(week, plan.week, {
    availability: ctx.input.availability,
    history: [],
    experienceLevel: ctx.input.experienceLevel,
    strengthVolume: ctx.input.strengthVolume,
    ...(ctx.input.ultraDistanceKm && { ultraDistanceKm: ctx.input.ultraDistanceKm }),
  });
  if (warnings.length > 0 && !m.confirm) return { ok: true, moved: false, warnings };

  try {
    // Saves the week if it hasn't been yet, so the move sticks.
    if (!(await storedSessionId(ctx, m.date, m.slot))) return { ok: false, errors: ["That session isn't in your plan any more. Refresh and try again."] };
    const row = await db.planWeek.findUniqueOrThrow({ where: { athleteId_weekStart: { athleteId: ctx.athleteId, weekStart: toDbDate(week.weekStart) } } });
    await db.$transaction(async (tx) => {
      const ids: string[] = [];
      // Two steps, because a day's slots must stay unique: park moving sessions on spare slots, then place them.
      for (const [i, change] of plan.changes.entries()) {
        const s = await tx.session.findUniqueOrThrow({ where: { weekId_date_slot: { weekId: row.id, date: toDbDate(change.from.date), slot: change.from.slot } } });
        await tx.session.update({ where: { id: s.id }, data: { slot: 10 + i } });
        ids.push(s.id);
      }
      for (const [i, change] of plan.changes.entries()) {
        await tx.session.update({ where: { id: ids[i] }, data: { date: toDbDate(change.to.date), slot: change.to.slot } });
      }
      await tx.planWeek.update({ where: { id: row.id }, data: { dayNotes: JSON.stringify(plan.week.dayNotes) } });
    });
  } catch (e) {
    console.error("Moving a session failed", e);
    return { ok: false, errors: ["That couldn't be moved just now. Try again in a moment."] };
  }
  return { ok: true, moved: true, warnings };
}
