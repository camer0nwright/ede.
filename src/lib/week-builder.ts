// Turns an outline week into a full week of dated sessions: each run and lift
// is placed on a day that fits the athlete's availability and ede.'s rules,
// runs get their steps, and lifts get their exercises. The plan checker
// validates the result like any other week. The AI may adjust days later.
import { addDays } from "./dates";
import { dayCap, type Availability, type BodyArea, type Equipment, type ExperienceLevel, type PlannedSession, type StrengthVolume, type WeekPlan } from "./domain";
import { OUTLINE_CONFIG, type OutlineRun, type OutlineStrength, type OutlineWeek, type PlanOutline } from "./plan-outline";
import { keyRunFlags } from "./key-runs";
import { buildRunSteps, RUN_LIBRARY } from "./session-library";
import { buildStrengthSession } from "./strength-builder";

export type WeekBuildInput = {
  availability: Availability;
  ultra: boolean;
  strengthVolume: StrengthVolume;
  experienceLevel: ExperienceLevel;
  equipment: Equipment[];
  /** Body area to keep lifts away from (an active injury). */
  avoid?: BodyArea;
};

/** Lower-body effort the day after a hard or long run (checker: lower-body-after-key-run). */
const LOWER_RPE_AFTER_KEY_RUN = 8;
/** Beginners stay off heavy barbell lifts for their first 8 weeks (SPEC: Beginner adjustments). */
const BEGINNER_MACHINE_WEEKS = 8;
const MIN_LIFT_MINUTES = 25;

type DaySlots = { day: number; cap1: number; cap2: number };
type RunPlace = { run: OutlineRun; day: number };
type LiftPlace = { lift: OutlineStrength; day: number; slot: 1 | 2; cap: number };

const isHardRun = (r: OutlineRun) => RUN_LIBRARY[r.kind].intensity === "hard";

/** Days with a hard or long run, exactly as the plan checker sees them. */
function keyRunDays(places: RunPlace[]): Set<number> {
  const flags = keyRunFlags(places.map((p) => ({ minutes: p.run.minutes, day: p.day, hard: isHardRun(p.run) })));
  return new Set(places.filter((_, i) => flags[i]).map((p) => p.day));
}
/** Heavy lower-body for placement: any lower session, or a hard full-body one. */
const isHeavyLegs = (l: OutlineStrength) => l.focus === "lower" || (l.focus === "full" && l.effort === "hard");

/**
 * Places runs: the long run on the longest day (weekends win ties), a
 * back-to-back long run the day after it, quality runs spread away from each
 * other, and easy runs on what's left. Returns run placements ranked best first.
 */
function placeRuns(runs: OutlineRun[], days: DaySlots[]): RunPlace[][] {
  const order = [...runs].sort((a, b) => b.minutes - a.minutes);
  const results: { places: RunPlace[]; score: number }[] = [];
  const used = new Set<number>();
  const places: RunPlace[] = [];

  const score = (ps: RunPlace[]) => {
    let s = 0;
    const long = ps.find((p) => p.run.role === "long" && !p.run.backToBack);
    if (long && long.day >= 5) s += 10; // long run at the weekend
    const hard = ps.filter((p) => isHardRun(p.run)).map((p) => p.day);
    for (const p of ps) {
      if (isHardRun(p.run) && long) s += Math.min(Math.abs(p.day - long.day), 3); // keep quality away from the long run
    }
    for (let i = 0; i < hard.length; i++) for (let j = i + 1; j < hard.length; j++) s += Math.min(Math.abs(hard[i] - hard[j]), 3);
    // Spread runs out: fewer runs on consecutive days.
    const sorted = ps.map((p) => p.day).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] === 1) s -= 1;
    return s;
  };

  const search = (k: number) => {
    if (results.length > 400) return;
    if (k === order.length) {
      results.push({ places: [...places], score: score(places) });
      return;
    }
    const run = order[k];
    for (const d of days) {
      if (used.has(d.day) || run.minutes > d.cap1) continue;
      if (run.backToBack) {
        const long = places.find((p) => p.run.role === "long" && !p.run.backToBack);
        if (long && Math.abs(long.day - d.day) !== 1) continue;
      }
      // No hard runs on consecutive days (checker: consecutive-hard-runs).
      if (isHardRun(run) && places.some((p) => isHardRun(p.run) && Math.abs(p.day - d.day) === 1)) continue;
      used.add(d.day);
      places.push({ run, day: d.day });
      search(k + 1);
      places.pop();
      used.delete(d.day);
    }
  };
  search(0);
  return results.sort((a, b) => b.score - a.score).map((r) => r.places);
}

/** Places lifts around the runs, keeping heavy legs away from key runs and off consecutive days. */
function placeLifts(lifts: OutlineStrength[], runs: RunPlace[], days: DaySlots[]): LiftPlace[] | null {
  const runOn = new Map(runs.map((p) => [p.day, p.run]));
  const keyDays = keyRunDays(runs);
  // Heaviest constraints first: lower body, then full body, then upper.
  const order = [...lifts].sort((a, b) => Number(isHeavyLegs(b)) - Number(isHeavyLegs(a)));
  let best: { places: LiftPlace[]; score: number } | null = null;
  const places: LiftPlace[] = [];

  type Option = { day: number; slot: 1 | 2; cap: number };
  const options = (lift: OutlineStrength): Option[] =>
    days.flatMap((d): Option[] => {
      if (places.some((p) => p.day === d.day)) return [];
      const run = runOn.get(d.day);
      if (run) {
        // A double day holds one run and one lift, never two hard sessions.
        if (d.cap2 < MIN_LIFT_MINUTES) return [];
        if (isHardRun(run) && lift.effort === "hard") return [];
        return [{ day: d.day, slot: 2, cap: d.cap2 }];
      }
      return d.cap1 >= MIN_LIFT_MINUTES ? [{ day: d.day, slot: 1, cap: d.cap1 }] : [];
    });

  const score = (ps: LiftPlace[]) => {
    let s = 0;
    for (const p of ps) {
      if (p.slot === 1) s += 2; // a lift on its own day is easier to fit into life than a double
      if (isHeavyLegs(p.lift) && keyDays.has(p.day - 1)) s -= 3; // allowed (capped at RPE 8) but not ideal
    }
    const sorted = ps.map((p) => p.day).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] === 1) s -= 1; // spread lifts out
    return s;
  };

  const search = (k: number) => {
    if (k === order.length) {
      const s = score(places);
      if (!best || s > best.score) best = { places: [...places], score: s };
      return;
    }
    const lift = order[k];
    for (const o of options(lift)) {
      if (isHeavyLegs(lift)) {
        // No heavy legs the day before or the same day as a hard or long run.
        if (keyDays.has(o.day) || keyDays.has(o.day + 1)) continue;
        // No heavy leg days back to back.
        if (places.some((p) => isHeavyLegs(p.lift) && Math.abs(p.day - o.day) === 1)) continue;
      }
      places.push({ lift, ...o });
      search(k + 1);
      places.pop();
    }
  };
  search(0);
  return (best as { places: LiftPlace[] } | null)?.places ?? null;
}

/**
 * Ever-gentler versions of a week's runs, for weeks too full to place with
 * every rule kept: first quality runs become easy runs (last one first), then
 * easy runs are shortened to fit a double day, so a run and a lift can share it.
 */
function* relaxations(runs: OutlineRun[], days: DaySlots[]): Generator<OutlineRun[]> {
  let current = runs;
  yield current;
  const qualityIndexes = current.map((r, i) => (r.role === "quality" ? i : -1)).filter((i) => i >= 0).reverse();
  for (const i of qualityIndexes) {
    current = current.map((r, j) => (j === i ? { role: "easy" as const, kind: "easy" as const, level: 1, minutes: r.minutes } : r));
    yield current;
  }
  const doubleCaps = days.filter((d) => d.cap2 > 0).map((d) => d.cap1).sort((a, b) => a - b);
  for (const cap of doubleCaps) {
    const i = current.findIndex((r) => r.role === "easy" && r.minutes > cap && cap >= 20);
    if (i < 0) continue;
    current = current.map((r, j) => (j === i ? { ...r, minutes: cap } : r));
    yield current;
  }
}

export type BuiltWeek = { week: WeekPlan; placed: boolean };

const weekTotal = (w: WeekPlan) => w.sessions.reduce((sum, x) => sum + x.plannedMinutes, 0);

/**
 * Builds every week of a plan in order. Recovery and taper weeks are trimmed
 * against the actual total of the last full week (checker: recovery 70%, taper
 * 60/80/90%), running first, then the light gym sessions, so the built plan
 * always passes.
 */
export function buildPlanWeeks(outline: PlanOutline, input: WeekBuildInput): BuiltWeek[] {
  const shares = OUTLINE_CONFIG.taperShares;
  let lastFullTotal: number | undefined;
  return outline.weeks.map((o, i) => {
    const built = buildWeek(o, input);
    const weeksOut = outline.weeks.length - 1 - i;
    const cap =
      lastFullTotal === undefined
        ? Infinity
        : o.phase === "recovery"
          ? lastFullTotal * OUTLINE_CONFIG.recoveryTotalShare
          : o.phase === "taper"
            ? lastFullTotal * (shares[weeksOut] ?? shares.at(-1)!)
            : Infinity;
    if (weekTotal(built.week) > cap) trimWeek(built.week, cap, input, o);
    if (o.phase !== "recovery" && o.phase !== "taper") lastFullTotal = weekTotal(built.week);
    return built;
  });
}

/** Trims a light week to `cap` minutes: runs down towards 20 minutes each, then lifts to fewer exercises. */
function trimWeek(week: WeekPlan, cap: number, input: WeekBuildInput, o: OutlineWeek) {
  const MIN_RUN = 20;
  const over = () => weekTotal(week) - cap;
  const runs = week.sessions.filter((x) => x.type === "run");
  while (over() > 0 && runs.some((r) => r.plannedMinutes > MIN_RUN)) {
    const longest = runs.reduce((a, b) => (b.plannedMinutes > a.plannedMinutes ? b : a));
    const cut = Math.min(5, longest.plannedMinutes - MIN_RUN);
    longest.plannedMinutes -= cut;
    if (longest.type === "run" && longest.kind) longest.steps = buildRunSteps(longest.kind, longest.level ?? 1, longest.plannedMinutes);
  }
  for (const lift of week.sessions) {
    if (over() <= 0) break;
    if (lift.type !== "strength") continue;
    const plan = o.strength.find((x) => x.focus === lift.bodyFocus);
    const rebuilt = buildStrengthSession({
      focus: lift.bodyFocus,
      volume: input.strengthVolume,
      effort: plan?.effort ?? "light",
      equipment: input.equipment,
      block: o.block,
      variant: plan?.variant ?? "A",
      avoid: input.avoid,
      maxMinutes: Math.max(OUTLINE_CONFIG.minLightStrengthMinutes, lift.plannedMinutes - over()),
      minExercises: 1,
    });
    lift.plannedMinutes = rebuilt.minutes;
    lift.exercises = rebuilt.exercises.map((e) => ({ name: e.name, warmupSets: e.warmupSets, workingSets: e.workingSets, reps: e.reps, targetRpe: e.targetRpe, failureAllowed: e.failureAllowed }));
  }
}

/**
 * Builds a full, dated week. If no placement satisfies every rule (a very
 * tight week), the sessions that fit are placed and `placed` is false.
 */
export function buildWeek(o: OutlineWeek, input: WeekBuildInput): BuiltWeek {
  const days: DaySlots[] = input.availability.flatMap((d, i) =>
    d.minutes === null ? [] : [{ day: i, cap1: dayCap(d.minutes, input.ultra), cap2: d.isDouble ? (d.secondMinutes ?? 0) : 0 }],
  );

  let runPlaces: RunPlace[] = [];
  let liftPlaces: LiftPlace[] | null = null;
  // Try the outline's runs first; if a full week can't be placed safely, relax it step by step.
  for (const runs of relaxations(o.runs, days)) {
    for (const candidate of placeRuns(runs, days).slice(0, 60)) {
      const lifts = placeLifts(o.strength, candidate, days);
      if (lifts) {
        runPlaces = candidate;
        liftPlaces = lifts;
        break;
      }
    }
    if (liftPlaces) break;
  }
  const placed = liftPlaces !== null && runPlaces.length === o.runs.length;
  if (!placed) runPlaces = placeRuns(o.runs, days)[0] ?? [];

  const date = (day: number) => addDays(o.weekStart, day);
  const keyDays = keyRunDays(runPlaces);
  const sessions: PlannedSession[] = [];
  const dayNotes: Record<string, string> = {};

  for (const { run, day } of runPlaces) {
    const spec = RUN_LIBRARY[run.kind];
    sessions.push({
      date: date(day),
      slot: 1,
      type: "run",
      title: run.backToBack ? "Back-to-back long run" : spec.label,
      intensity: spec.intensity,
      plannedMinutes: run.minutes,
      isKeySession: run.role !== "easy",
      steps: buildRunSteps(run.kind, run.level, run.minutes),
      kind: run.kind,
      level: run.level,
    });
  }

  for (const { lift, day, slot, cap } of liftPlaces ?? []) {
    const built = buildStrengthSession({
      focus: lift.focus,
      volume: input.strengthVolume,
      effort: lift.effort,
      equipment: input.equipment,
      block: o.block,
      variant: lift.variant,
      avoid: input.avoid,
      avoidBarbell: input.experienceLevel === "beginner" && o.weekNumber <= BEGINNER_MACHINE_WEEKS,
      maxLowerRpe: keyDays.has(day - 1) ? LOWER_RPE_AFTER_KEY_RUN : undefined,
      // Light weeks keep to the outline's shorter time; hard sessions get a little leeway.
      maxMinutes: Math.min(cap, lift.effort === "hard" ? lift.minutes + 15 : lift.minutes),
    });
    sessions.push({
      date: date(day),
      slot,
      type: "strength",
      title: { upper: "Upper body", lower: "Lower body", full: "Full body" }[lift.focus],
      intensity: lift.effort === "hard" ? "hard" : "moderate",
      plannedMinutes: built.minutes,
      isKeySession: false,
      bodyFocus: lift.focus,
      exercises: built.exercises.map((e) => ({
        name: e.name,
        warmupSets: e.warmupSets,
        workingSets: e.workingSets,
        reps: e.reps,
        targetRpe: e.targetRpe,
        failureAllowed: e.failureAllowed,
      })),
    });
    // Run first on a double day with a hard or long run, or any hour-plus session that isn't an easy run.
    const sameDayRun = runPlaces.find((p) => p.day === day);
    if (sameDayRun && (keyDays.has(day) || (sameDayRun.run.role !== "easy" && sameDayRun.run.minutes >= 60))) {
      dayNotes[date(day)] = "Run first, then lift at least 6 hours later.";
    }
  }

  sessions.sort((a, b) => (a.date === b.date ? a.slot - b.slot : a.date < b.date ? -1 : 1));
  return {
    week: { weekStart: o.weekStart, weekNumber: o.weekNumber, phase: o.phase, sessions, dayNotes, coachNote: "" },
    placed,
  };
}
