// Bringing a saved plan up to date with ede.'s current coaching (SPEC decision
// 79): the first time its owner opens ede. after the coaching changed, the plan
// is rebuilt from next Monday with their own settings, just as if they had
// saved them again in You. This week and everything before it stay as they were.
import "server-only";
import { db } from "@/lib/db";
import { PLAN_VERSION } from "@/lib/plan-outline";
import { rebuildOutline, rebuildStart } from "@/lib/plan-rebuild";
import type { PlanContext } from "@/server/athlete";
import { saveRebuiltPlan } from "@/server/plan-save";

export async function refreshPlan(ctx: PlanContext & { athleteId: string; outlineId: string }): Promise<void> {
  const start = rebuildStart(ctx.today, ctx.input.startDate);
  try {
    rebuildOutline(ctx.outline, { ...ctx.input, startDate: start }, start);
  } catch (e) {
    // These settings no longer make a plan from next Monday (say, the race has
    // passed): keep the plan as it is and don't try again.
    console.error("Refreshing a plan failed; keeping it as it is", e);
    await db.planOutline.update({ where: { id: ctx.outlineId }, data: { outline: JSON.stringify({ ...ctx.outline, version: PLAN_VERSION }) } });
    return;
  }
  await saveRebuiltPlan(ctx, {
    athleteId: ctx.athleteId,
    input: ctx.input,
    coachingRefresh: true,
    // Two pages opening at once: only the first rebuilds.
    alsoSave: async (tx) => {
      if ((await tx.planOutline.count({ where: { id: ctx.outlineId, active: true } })) === 0) throw new Error("Plan already refreshed");
    },
  });
}
