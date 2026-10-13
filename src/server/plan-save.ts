// Rebuilding a saved plan from next Monday and saving it (SPEC decision 41):
// used when settings change and when an injury is marked better. The weeks
// up to and including this one are saved as they are, so they don't change.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { sessionKey } from "@/lib/checkin";
import { db } from "@/lib/db";
import { sessionToRow, toDbDate, weekToRow } from "@/lib/db-mapping";
import type { OutlineInput, PlanOutline } from "@/lib/plan-outline";
import { continuityFromWeeks, rebuildOutline, rebuildStart } from "@/lib/plan-rebuild";
import { builtWeeks, type PlanContext } from "@/server/athlete";

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

export async function saveRebuiltPlan(
  ctx: PlanContext,
  opts: {
    athleteId: string;
    /** The plan's settings as an outline input (its start date is replaced). */
    input: OutlineInput;
    /** The load to carry on from. Defaults to the last full week before any injury. */
    continuity?: { lastWeekRunMinutes?: number; longestRecentRunMinutes?: number };
    /** Coming back from an injury. */
    returning?: boolean;
    /** Where the rebuilt plan starts (default: next Monday, or the plan's start if it hasn't begun). */
    start?: string;
    /** Other changes saved in the same transaction. */
    alsoSave?: (tx: Prisma.TransactionClient) => Promise<unknown>;
  },
): Promise<SaveResult> {
  const start = opts.start ?? rebuildStart(ctx.today, ctx.input.startDate);
  const kept = builtWeeks(ctx).filter((b) => b.week.weekStart < start);
  const continuity = opts.continuity ?? continuityFromWeeks(kept.filter((b) => !b.injured).map((b) => b.week));
  const fresh: OutlineInput = { ...opts.input, ...continuity, startDate: start, ...(opts.returning && { returning: true }) };
  let outline: PlanOutline;
  try {
    outline = rebuildOutline(ctx.outline, fresh, start);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "Couldn't build a plan from those settings."] };
  }
  // The saved input keeps the plan's own start and starting load.
  const input: OutlineInput = {
    ...opts.input,
    startDate: ctx.input.startDate,
    lastWeekRunMinutes: ctx.input.lastWeekRunMinutes,
    longestRecentRunMinutes: ctx.input.longestRecentRunMinutes,
  };
  const alreadyStored = new Set(ctx.storedWeeks.map((w) => w.weekStart));

  try {
    await db.$transaction(async (tx) => {
      const id = opts.athleteId;
      await opts.alsoSave?.(tx);
      await tx.planOutline.updateMany({ where: { athleteId: id, active: true }, data: { active: false } });
      const created = await tx.planOutline.create({ data: { athleteId: id, input: JSON.stringify(input), outline: JSON.stringify(outline) } });
      await tx.planWeek.deleteMany({ where: { athleteId: id, weekStart: { gte: toDbDate(start) } } });
      for (const { week, injured } of kept) {
        if (alreadyStored.has(week.weekStart)) {
          // A saved week changed by an injury is saved again as it now is,
          // unless something in it has been checked in (that history stays).
          const checkedIn = week.sessions.some((s) => ctx.checkIns[sessionKey(s.date, s.slot)]);
          if (!injured || checkedIn) continue;
          await tx.planWeek.deleteMany({ where: { athleteId: id, weekStart: toDbDate(week.weekStart) } });
        }
        await tx.planWeek.create({
          data: { athleteId: id, outlineId: created.id, ...weekToRow(week), sessions: { create: week.sessions.map(sessionToRow) } },
        });
      }
    });
  } catch (e) {
    console.error("Saving the rebuilt plan failed", e);
    return { ok: false, errors: ["Your changes couldn't be saved just now. Try again in a moment."] };
  }
  return { ok: true };
}
