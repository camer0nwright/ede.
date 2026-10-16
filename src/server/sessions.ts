// Planned sessions in the database. Weeks are built on the fly until
// something in them is checked in or started; then the week is saved and stays
// exactly as it was.
import "server-only";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { sessionToRow, toDbDate, weekToRow } from "@/lib/db-mapping";
import { builtWeeks, getPlanContext, type PlanContext } from "@/server/athlete";

export type SignedInContext = PlanContext & { athleteId: string };

/** The plan context for a signed-in athlete, or null for the demo. */
export async function signedInContext(): Promise<SignedInContext | null> {
  const ctx = await getPlanContext();
  return ctx.isDemo || !ctx.athleteId ? null : (ctx as SignedInContext);
}

/**
 * The database id of a planned session, saving its week first if it hasn't
 * been yet (weeks are built on the fly until something in them is checked in,
 * then kept exactly as they were).
 */
export async function storedSessionId(ctx: SignedInContext, date: string, slot: number): Promise<string | null> {
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

