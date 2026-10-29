// When and how a week is tailored by the AI coach (SPEC decision 51): the
// input it's given, and when the offer appears. Server only.
import "server-only";
import { sessionKey } from "@/lib/checkin";
import { addDays, dayOfWeek } from "@/lib/dates";
import { DAY_NAMES } from "@/lib/domain";
import { splitFor } from "@/lib/plan-outline";
import { RUN_LIBRARY } from "@/lib/session-library";
import { runMinutes, totalMinutes, type CheckContext, type PastWeek } from "@/server/plan-checker/rules";
import { aiConfigured } from "@/server/plan-ai";
import { builtWeeks, type PlanContext } from "@/server/athlete";

/** From Friday, next week can be tailored once (before anything in it happens). */
export const TAILOR_FROM_DAY = 4;

/** The week the coach can tailor now, if any: next week, from Friday, not yet saved. */
export function tailorOffer(ctx: PlanContext) {
  if (ctx.isDemo || !aiConfigured() || dayOfWeek(ctx.today) < TAILOR_FROM_DAY) return null;
  const weeks = builtWeeks(ctx);
  const index = weeks.findIndex((b) => b.week.weekStart <= ctx.today && ctx.today <= addDays(b.week.weekStart, 6));
  const next = weeks[index + 1];
  if (index < 0 || !next || ctx.storedWeeks.some((w) => w.weekStart === next.week.weekStart)) return null;
  return { index: index + 1, weekNumber: next.week.weekNumber, weekStart: next.week.weekStart };
}

/** Everything the AI is given about the athlete and the coming week (the INPUT in prompts/plan-engine.md). */
export function tailorInput(ctx: PlanContext, index: number) {
  const weeks = builtWeeks(ctx);
  const week = weeks[index].week;
  const outline = ctx.outline.weeks[index];
  const previous = weeks[index - 1]?.week;
  const recent = weeks.slice(Math.max(0, index - 2), index).flatMap((b) => b.week.sessions);
  return {
    goal: `${ctx.title}: ${ctx.goal}`,
    ...(ctx.input.raceDistance && { race_distance: ctx.input.raceDistance }),
    ...(ctx.input.ultraDistanceKm && { ultra_distance_km: ctx.input.ultraDistanceKm, terrain: ctx.input.terrain }),
    ...(ctx.input.targetDate && { target_date: ctx.input.targetDate }),
    ...(ctx.input.justFinish && { just_finish: true }),
    ...(ctx.paces.fiveKSeconds && { recent_5k_time_seconds: ctx.paces.fiveKSeconds }),
    ...(ctx.paces.estimated && { paces_estimated: true }),
    // This week's counts, as built: near a race one lift may have become a run.
    runs_per_week: outline.runs.length,
    strength_sessions_per_week: outline.strength.length,
    experience_level: ctx.input.experienceLevel,
    strength_volume: ctx.input.strengthVolume,
    gym_split: splitFor(ctx.input),
    equipment: ctx.build.equipment,
    ...(ctx.injury && { injury: { area: ctx.injury.area, pain_level: ctx.injury.painLevel, pain_when: ctx.injury.painWhen }, injury_notes: ctx.injury.notes ?? "" }),
    week_number: week.weekNumber,
    phase: week.phase,
    outline: {
      phase: outline.phase,
      run_minutes: outline.runMinutes,
      runs: outline.runs.map((r) => ({ role: r.role, session_kind: r.kind, level: r.level, minutes: r.minutes })),
    },
    ...(previous && { last_week_run_minutes: runMinutes(previous), last_week_strength_minutes: totalMinutes(previous) - runMinutes(previous) }),
    availability: ctx.input.availability.map((d, i) =>
      d.minutes === null
        ? { day: DAY_NAMES[i], rest: true }
        : { day: DAY_NAMES[i], minutes_available: d.minutes, double_day: d.isDouble, ...(d.isDouble && { second_session_minutes: d.secondMinutes }) },
    ),
    recent_check_ins: recent.map((s) => {
      const c = ctx.checkIns[sessionKey(s.date, s.slot)];
      return {
        date: s.date,
        title: s.title,
        type: s.type,
        planned_minutes: s.plannedMinutes,
        planned_intensity: s.intensity,
        status: c?.status ?? (s.date < ctx.today ? "not checked in" : "planned"),
        ...(c?.status === "completed" && { minutes: c.actualMinutes, effort: c.effort }),
        ...(c?.status === "skipped" && { skip_reason: c.skipReason }),
        ...(c?.notes && { notes: c.notes }),
      };
    }),
  };
}

/** The checker's context for the tailored week: the athlete's rules, the weeks before it, and ede.'s own version. */
export function tailorCheckContext(ctx: PlanContext, index: number): CheckContext {
  const weeks = builtWeeks(ctx);
  const history: PastWeek[] = weeks.slice(0, index).map(({ week, injured }) => {
    const quality = week.sessions.flatMap((s) => (s.type === "run" && s.kind && RUN_LIBRARY[s.kind].role === "quality" ? [{ kind: s.kind, level: s.level ?? 1 }] : []));
    return { totalMinutes: totalMinutes(week), runMinutes: runMinutes(week), phase: week.phase, ...(quality.length > 0 && { quality }), ...(injured && { injured }) };
  });
  return {
    availability: ctx.input.availability,
    history,
    ...(ctx.input.targetDate && { targetDate: ctx.input.targetDate }),
    experienceLevel: ctx.input.experienceLevel,
    strengthVolume: ctx.input.strengthVolume,
    ...(ctx.injury && weeks[index].injured && { injury: ctx.injury }),
    lastWeekRunMinutes: ctx.input.lastWeekRunMinutes,
    ...(ctx.input.ultraDistanceKm && { ultraDistanceKm: ctx.input.ultraDistanceKm }),
    previousVersion: weeks[index].week,
  };
}
