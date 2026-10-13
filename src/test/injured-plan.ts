// An injured athlete's whole plan, as the app runs it: shared by the injury tests.
import { ALL_RULES, runMinutes, totalMinutes, type PastWeek } from "@/server/plan-checker/rules";
import { addDays } from "@/lib/dates";
import type { Injury, WeekPlan } from "@/lib/domain";
import { adaptWeeksForInjury, injuryBand } from "@/lib/injury";
import { buildPlanOutline, type OutlineInput } from "@/lib/plan-outline";
import { continuityFromWeeks, rebuildOutline, returnFromInjury } from "@/lib/plan-rebuild";
import { RUN_LIBRARY } from "@/lib/session-library";
import { equipmentFromAnswers } from "@/lib/strength-builder";
import { buildPlanWeeks, type WeekBuildInput } from "@/lib/week-builder";

export const equipment = equipmentFromAnswers(["Full gym"]);
export const build = (input: OutlineInput): WeekBuildInput => ({
  availability: input.availability,
  ultra: input.raceDistance === "ultra",
  strengthVolume: input.strengthVolume,
  experienceLevel: input.experienceLevel,
  equipment,
});

function pastWeek(w: WeekPlan, injured: boolean): PastWeek {
  const quality = w.sessions.flatMap((s) => (s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality" ? [{ kind: s.kind, level: s.level ?? 1 }] : []));
  return { totalMinutes: totalMinutes(w), runMinutes: runMinutes(w), phase: w.phase, ...(quality.length > 0 && { quality }), ...(injured && { injured }) };
}

/**
 * The whole story, as the app runs it: injured from the start of week
 * `fromWeek` for `weeksOut` weeks, then marked better and the plan rebuilt
 * from the next Monday with a gentle return. Every week is checked.
 */
export function injuredPlan(input: OutlineInput, injury: Injury, fromWeek: number, weeksOut: number) {
  const outline = buildPlanOutline(input);
  const since = outline.weeks[fromWeek].weekStart;
  const opts = { injury, since, lastWeekRunMinutes: input.lastWeekRunMinutes, blocks: outline.weeks.map((w) => w.block), volume: input.strengthVolume, equipment, experienceLevel: input.experienceLevel };
  const during = adaptWeeksForInjury(buildPlanWeeks(outline, { ...build(input), avoid: injury.area }).map((b) => b.week), opts);

  // Marked better: rebuild from the Monday after the injury weeks.
  const start = addDays(since, 7 * weeksOut);
  const kept = during.filter(({ week }) => week.weekStart < start);
  const before = continuityFromWeeks(kept.filter((k) => !k.injured).map((k) => k.week));
  const back = returnFromInjury(
    { lastWeekRunMinutes: before.lastWeekRunMinutes ?? input.lastWeekRunMinutes ?? 0, longestRecentRunMinutes: before.longestRecentRunMinutes ?? input.longestRecentRunMinutes ?? 0 },
    weeksOut,
    injuryBand(injury) === "mild",
  );
  const rebuilt = rebuildOutline(outline, { ...input, ...back, returning: true }, start);
  const after = buildPlanWeeks(rebuilt, build(input)).filter((b) => b.week.weekStart >= start);
  const weeks = [...kept, ...after.map((b) => ({ week: b.week, injured: false }))];

  const history: PastWeek[] = [];
  return weeks.map(({ week, injured }) => {
    const violations = ALL_RULES.flatMap((rule) =>
      rule(week, {
        availability: input.availability,
        history: [...history],
        lastWeekRunMinutes: input.lastWeekRunMinutes,
        targetDate: input.targetDate,
        experienceLevel: input.experienceLevel,
        strengthVolume: input.strengthVolume,
        ...(input.raceDistance === "ultra" && { ultraDistanceKm: input.ultraDistanceKm }),
        ...(injured && { injury }),
      }),
    );
    history.push(pastWeek(week, injured));
    return { week, injured, violations };
  });
}

