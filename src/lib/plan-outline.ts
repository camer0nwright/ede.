// The plan outline: built by code (not the AI) right after onboarding. For
// every week of the plan it sets the phase, run minutes, and which library
// session (kind + level) goes in each role. The AI later turns each week into
// full sessions on specific days. See SPEC.md "Plan outline and session variety".
import { addDays, dayOfWeek, daysBetween } from "./dates";
import {
  easyRunMinutes,
  type Availability,
  type BodyFocus,
  type ExperienceLevel,
  type GoalType,
  type Phase,
  type PlannedSession,
  type RaceDistance,
  type RunKind,
  type StrengthVolume,
  type Terrain,
} from "./domain";
import { buildRunSteps, maxLevel, minMinutes, RUN_LIBRARY, type RunRole } from "./session-library";

export type OutlineInput = {
  /** First day of the plan; must be a Monday. */
  startDate: string;
  goalType: GoalType;
  raceDistance?: RaceDistance;
  /** Race or goal date (YYYY-MM-DD). Without one, the plan is a rolling 8-week block. */
  targetDate?: string;
  ultraDistanceKm?: number;
  terrain?: Terrain;
  experienceLevel: ExperienceLevel;
  strengthVolume: StrengthVolume;
  availability: Availability;
  /** Run minutes in the week before the plan starts, if known. */
  lastWeekRunMinutes?: number;
};

export type OutlineRun = {
  role: RunRole;
  kind: RunKind;
  level: number;
  minutes: number;
  /** The second day of a back-to-back long run weekend (ultras). */
  backToBack?: boolean;
};

export type StrengthEffort = "hard" | "light" | "technique";

export type OutlineStrength = {
  focus: BodyFocus;
  /** Accessory exercises alternate A/B week to week; main lifts stay the same within a block. */
  variant: "A" | "B";
  effort: StrengthEffort;
  minutes: number;
};

export type OutlineWeek = {
  weekNumber: number;
  weekStart: string;
  phase: Phase;
  /** Increases after each recovery week; main lifts can change between blocks. */
  block: number;
  runMinutes: number;
  strengthMinutes: number;
  runs: OutlineRun[];
  strength: OutlineStrength[];
};

export type PlanOutline = {
  weeks: OutlineWeek[];
  taperWeeks: number;
  /** Gentle notes for the user, such as a plan shorter than recommended. */
  notes: string[];
};

export const OUTLINE_CONFIG = {
  /** Weeks in a rolling block when there is no target date. */
  blockWeeks: 8,
  /** Every 4th week is a recovery week (after 3 build weeks). */
  recoveryEvery: 4,
  /** Share of non-taper weeks that are base phase (race plans). */
  baseShare: 0.3,
  /** Weeks before the taper that count as peak (race plans). */
  peakWeeks: 2,
  startingRunMinutes: { beginner: 50, other: 75 },
  startingRange: { beginner: 60, other: 90 },
  startingBelow: 60,
  /** Weekly run growth: 8% or 10 min, staying inside the checker's 10% / 20 min limit. */
  growthShare: 0.08,
  minGrowthMinutes: 10,
  maxGrowthShare: 0.1,
  maxGrowthMinutes: 20,
  /** Recovery weeks: about 35% less running, and total load under 70% of the last build week. */
  recoveryRunShare: 0.65,
  recoveryTotalShare: 0.68,
  /** Taper totals, slightly under the checker's 60/80/90%. Index 0 is race week. */
  taperShares: [0.55, 0.75, 0.85],
  /** Easy share targets (the checker's minimum is 80%). */
  easyShare: { default: 0.8, ultra: 0.9 },
  minEasyRunMinutes: 20,
  strengthMinutes: { low: 40, moderate: 55, high: 70 },
} as const;
const O = OUTLINE_CONFIG;

const round5 = (n: number) => Math.round(n / 5) * 5;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

// ---------- goal profiles ----------

type DistanceKey = RaceDistance | "general" | "strength";

function distanceKey(input: OutlineInput): DistanceKey {
  if (input.goalType === "race" && input.raceDistance) return input.raceDistance;
  return input.goalType === "strength" ? "strength" : "general";
}

const isTrail = (input: OutlineInput) => input.terrain === "trail" || input.terrain === "mountain";

/** Quality sessions rotate through these, in order. */
function qualityPool(input: OutlineInput): RunKind[] {
  switch (distanceKey(input)) {
    case "5k":
      return ["intervals_short", "hills", "intervals_long", "fartlek"];
    case "10k":
      return ["intervals_long", "tempo", "intervals_short", "hills"];
    case "half":
      return ["tempo", "intervals_long", "progression", "hills"];
    case "marathon":
      return ["tempo", "progression", "intervals_long", "fartlek"];
    case "ultra":
      return isTrail(input)
        ? ["hills", "aerobic_power", "hill_hike", "fartlek"]
        : ["aerobic_power", "hills", "fartlek", "tempo"];
    case "strength":
      return ["fartlek", "tempo", "hills"];
    default:
      return ["fartlek", "intervals_short", "tempo", "hills"];
  }
}

/** Long run variations rotate through these in build and peak weeks. */
function longPool(input: OutlineInput): RunKind[] {
  switch (distanceKey(input)) {
    case "half":
    case "marathon":
      return ["long_easy", "long_fast_finish", "long_easy", "long_race_pace"];
    case "ultra":
      return isTrail(input)
        ? ["long_hilly", "long_easy", "long_hilly", "long_fast_finish"]
        : ["long_easy", "long_easy", "long_fast_finish"];
    default:
      return ["long_easy", "long_easy", "long_fast_finish"];
  }
}

function ultraBand(km = 50): 0 | 1 | 2 | 3 {
  if (km < 60) return 0; // 50K
  if (km < 90) return 1; // 50 miles
  if (km < 130) return 2; // 100K
  return 3; // 100 miles
}

/** Peak weekly run minutes. */
function peakRunMinutes(input: OutlineInput): number {
  const k = distanceKey(input);
  const base =
    k === "ultra"
      ? [420, 480, 540, 600][ultraBand(input.ultraDistanceKm)]
      : { "5k": 240, "10k": 280, half: 330, marathon: 420, general: 210, strength: 150 }[k];
  const factor = { beginner: 0.6, intermediate: 1, advanced: 1.2 }[input.experienceLevel];
  return round5(base * factor);
}

/** Longest a long run should get, in minutes. */
function longRunCap(input: OutlineInput): number {
  const k = distanceKey(input);
  const base =
    k === "ultra"
      ? [240, 300, 390, 480][ultraBand(input.ultraDistanceKm)]
      : { "5k": 75, "10k": 90, half: 120, marathon: 165, general: 90, strength: 75 }[k];
  return input.experienceLevel === "beginner" ? round5(base * 0.75) : base;
}

function longShare(input: OutlineInput): number {
  if (input.experienceLevel === "beginner") return 0.35;
  const k = distanceKey(input);
  if (k === "ultra") return 0.4;
  return k === "half" || k === "marathon" ? 0.33 : 0.3;
}

/** Most of the week's running one long run (or a back-to-back pair) may take. */
function maxLongShare(input: OutlineInput, runs: number, backToBack: boolean): number {
  if (runs <= 2) return 0.65;
  if (runs === 3) return 0.5;
  const base = distanceKey(input) === "ultra" ? 0.45 : 0.4;
  return backToBack ? base + 0.15 : base;
}

/** Recommended plan length in weeks, for the "shorter than recommended" note. */
function recommendedWeeks(input: OutlineInput): number {
  const k = distanceKey(input);
  if (k === "ultra") return [12, 16, 16, 20][ultraBand(input.ultraDistanceKm)];
  return { "5k": 6, "10k": 8, half: 10, marathon: 12, general: 0, strength: 0 }[k];
}

function desiredRuns(input: OutlineInput): number {
  if (input.experienceLevel === "beginner") return 3;
  const k = distanceKey(input);
  const base = { "5k": 4, "10k": 4, half: 4, marathon: 5, ultra: 5, general: 3, strength: 2 }[k];
  return input.experienceLevel === "advanced" ? Math.min(base + 1, 6) : base;
}

function desiredStrength(input: OutlineInput): number {
  if (input.goalType === "strength") return input.strengthVolume === "high" ? 4 : 3;
  return 2;
}

const FOCUS_PATTERNS: Record<number, BodyFocus[]> = {
  1: ["full"],
  2: ["lower", "upper"],
  3: ["lower", "upper", "full"],
  4: ["lower", "upper", "lower", "upper"],
};

// ---------- availability ----------

function availabilityFacts(availability: Availability) {
  const days = availability.filter((d) => d.minutes !== null);
  // Keep at least one rest day even if every day is marked available.
  const trainingDays = Math.min(days.length, 6);
  const doubleDays = days.filter((d) => d.isDouble).length;
  const open = (m: number) => (m >= 120 ? Infinity : m);
  /** Each available day's time for its first session, longest first ("120" means 120+). */
  const dayCaps = days.map((d) => open(d.minutes!)).sort((a, b) => b - a).slice(0, trainingDays);
  const longestDay = dayCaps[0] ?? 0;
  // Two days in a row with 60+ minutes each (for back-to-back long runs).
  const long = (m: number | null) => m !== null && open(m) >= 60;
  const backToBackPossible = availability.some((d, i) => i < 6 && long(d.minutes) && long(availability[i + 1].minutes));
  /** Most running that fits on the `n` longest days. */
  const runCapacity = (n: number) => dayCaps.slice(0, n).reduce((sum, m) => sum + m, 0);
  return { trainingDays, doubleDays, dayCaps, longestDay, backToBackPossible, runCapacity };
}

// ---------- phases ----------

function planLength(input: OutlineInput): number {
  if (!input.targetDate) return O.blockWeeks;
  const days = daysBetween(input.startDate, input.targetDate);
  if (days < 0) throw new Error("The target date is before the plan starts.");
  return Math.min(Math.floor(days / 7) + 1, 52);
}

function taperLength(input: OutlineInput): number {
  if (!input.targetDate) return 0;
  return (input.ultraDistanceKm ?? 0) >= 160 ? 3 : 2;
}

function phaseFor(i: number, n: number, input: OutlineInput, taper: number): Phase {
  const weeksOut = input.targetDate ? n - 1 - i : null;
  if (weeksOut !== null && weeksOut < taper) return "taper";
  if ((i + 1) % O.recoveryEvery === 0) return "recovery";
  if (weeksOut !== null && weeksOut < taper + O.peakWeeks) return "peak";
  const baseWeeks = input.targetDate ? Math.max(1, Math.round((n - taper) * O.baseShare)) : 3;
  return i < baseWeeks ? "base" : "build";
}

// ---------- outline ----------

export function buildPlanOutline(input: OutlineInput): PlanOutline {
  if (dayOfWeek(input.startDate) !== 0) throw new Error("The plan must start on a Monday.");

  const n = planLength(input);
  const taper = taperLength(input);
  const avail = availabilityFacts(input.availability);
  const beginner = input.experienceLevel === "beginner";
  const isUltra = distanceKey(input) === "ultra";
  const notes: string[] = [];

  const recommended = recommendedWeeks(input);
  if (input.targetDate && n < recommended) {
    notes.push(`Your plan is ${n} weeks; about ${recommended} weeks is recommended for this distance. ede. will build what fits safely.`);
  }
  if (isUltra && (beginner || (input.lastWeekRunMinutes ?? 0) < 180)) {
    notes.push("Ultras go best from a solid base (around marathon-level training). Consider a longer build or a shorter race first.");
  }

  const qPool = qualityPool(input);
  const lPool = longPool(input);
  const startLevel = input.experienceLevel === "advanced" ? 2 : 1;
  const uses = new Map<RunKind, number>(); // times each kind has been used at full level
  const lastLevel = new Map<RunKind, number>();
  let qPointer = 0;
  let lPointer = 0;
  let nonRecoveryWeeks = 0;

  const peakCap = peakRunMinutes(input);
  const strengthMin = O.strengthMinutes[input.strengthVolume];

  let prevRun = input.lastWeekRunMinutes;
  let lastBuild: { run: number; total: number } | undefined;
  let block = 1;
  let limitedByTime = false;
  const weeks: OutlineWeek[] = [];

  for (let i = 0; i < n; i++) {
    const phase = phaseFor(i, n, input, taper);
    const weeksOut = input.targetDate ? n - 1 - i : null;
    const starting = prevRun === undefined || prevRun < O.startingBelow;

    // ----- run minutes target -----
    let target: number;
    if (phase === "recovery" && lastBuild) {
      target = lastBuild.run * O.recoveryRunShare;
    } else if (phase === "taper" && lastBuild) {
      target = lastBuild.run * O.taperShares[weeksOut!];
    } else if (prevRun === undefined) {
      target = beginner ? O.startingRunMinutes.beginner : O.startingRunMinutes.other;
    } else {
      const ref = lastBuild?.run ?? prevRun;
      const growth = Math.min(
        Math.max(ref * O.growthShare, O.minGrowthMinutes),
        Math.max(ref * O.maxGrowthShare, O.maxGrowthMinutes),
      );
      target = i === 0 ? ref : ref + growth;
      if (starting) target = Math.min(target, beginner ? O.startingRange.beginner : O.startingRange.other);
    }
    target = round5(Math.min(target, peakCap));

    // ----- how many runs and lifts -----
    let runs = Math.min(desiredRuns(input), avail.trainingDays);
    if (starting && phase !== "recovery" && phase !== "taper") runs = Math.min(Math.max(runs, 2), 3);
    runs = Math.max(1, Math.min(runs, Math.floor(target / O.minEasyRunMinutes)));
    let lifts = desiredStrength(input);
    if (phase === "recovery" || phase === "taper") lifts = Math.max(1, lifts - 1);
    const slots = avail.trainingDays + avail.doubleDays;
    while (runs + lifts > slots && lifts > 1) lifts--;
    while (runs + lifts > slots && runs > 1) runs--;
    target = Math.min(target, round5(avail.runCapacity(runs)));

    // ----- choose session kinds -----
    const fullLevel = phase !== "recovery" && phase !== "taper";
    const levelFor = (kind: RunKind) => {
      const used = uses.get(kind) ?? 0;
      const level = fullLevel
        ? Math.min(startLevel + used, maxLevel(kind))
        : Math.max(1, (lastLevel.get(kind) ?? startLevel) - 1);
      return level;
    };

    let qualityCount = 0;
    if (!beginner && runs >= 2) {
      if (phase === "recovery") qualityCount = 0;
      else if (phase === "taper") qualityCount = 1;
      else if (isUltra || distanceKey(input) === "general" || distanceKey(input) === "strength") qualityCount = 1;
      else qualityCount = phase !== "base" && runs >= 4 ? 2 : 1;
    }

    const backToBack =
      isUltra && avail.backToBackPossible && runs >= 3 && (phase === "build" || phase === "peak") &&
      (weeksOut !== null ? [8, 5, 3].includes(weeksOut) : nonRecoveryWeeks % 4 === 3);

    const quality: RunKind[] = [];
    for (let q = 0; q < qualityCount; q++) quality.push(qPool[(qPointer + q) % qPool.length]);

    const longKind: RunKind = beginner
      ? "run_walk"
      : fullLevel && phase !== "base" && !backToBack
        ? lPool[lPointer % lPool.length]
        : isUltra && isTrail(input)
          ? "long_hilly"
          : "long_easy";

    // Beginners progress their run/walk ratio every 2 weeks.
    const runWalkLevel = Math.min(1 + Math.floor(nonRecoveryWeeks / 2) - (phase === "recovery" ? 1 : 0), maxLevel("run_walk"));
    const easyKind: RunKind = beginner ? "run_walk" : "easy";
    // One easy run a week gets strides (non-beginners), for variety and leg speed.
    const stridesWeek = !beginner && runs - qualityCount - 1 - (backToBack ? 1 : 0) >= 2;

    // ----- allocate minutes -----
    // Runs are matched to the longest available days: the long run gets the
    // longest day, then the back-to-back day, quality sessions, then easy runs.
    // Every run fits its day, and the long run is the longest run of the week.
    const allocate = (qualityKinds: RunKind[], long: RunKind): OutlineRun[] => {
      const caps = [...avail.dayCaps.slice(0, runs)];
      const out: OutlineRun[] = [];
      const longCount = runs - qualityKinds.length >= 1 ? (backToBack ? 2 : 1) : 0;
      const longCaps = caps.splice(0, longCount);

      let qualityTotal = 0;
      const qualityRuns: OutlineRun[] = [];
      for (const wanted of qualityKinds) {
        const cap = caps.shift() ?? 0;
        // If this kind's next level doesn't fit the day, use the next kind in the
        // rotation that does, so levels never go backwards in a build week.
        const options = [wanted, ...qPool.filter((k) => k !== wanted && !qualityKinds.includes(k))];
        const kind = options.find((k) => minMinutes(k, levelFor(k)) <= cap);
        if (!kind) continue; // nothing fits any day: leave it out
        const level = levelFor(kind);
        const minutes = Math.min(ceil5(minMinutes(kind, level)), cap);
        qualityRuns.push({ role: "quality", kind, level, minutes });
        qualityTotal += minutes;
      }
      out.push(...qualityRuns);

      let easyCaps = caps;
      let remaining = target - qualityTotal;
      let longRuns: OutlineRun[] = [];
      if (longCount > 0) {
        const longLevel = long === "run_walk" ? Math.max(1, runWalkLevel) : levelFor(long);
        const share = backToBack ? 0.3 : longShare(input);
        const fairShare = remaining / (longCount + easyCaps.length) + 5;
        // Back-to-back: size the second day first, so the pair stays within its share of the week.
        const second = backToBack ? round5(Math.min(Math.max(60, target * 0.22), longCaps[1])) : 0;
        const longMax = Math.min(longRunCap(input), longCaps[0], target * maxLongShare(input, runs, backToBack) - second);
        const first = round5(Math.min(Math.max(target * share, fairShare, minMinutes(long, longLevel)), longMax, Math.max(remaining, 20)));
        longRuns.push({ role: "long", kind: long, level: longLevel, minutes: first });
        if (backToBack) {
          longRuns.push({ role: "long", kind: "long_easy", level: 1, minutes: Math.min(second, first) , backToBack: true });
        }
        remaining -= sum(longRuns);
      }

      // Make room for easy runs of at least 20 minutes by shortening the long run.
      if (longRuns.length > 0 && easyCaps.length > 0 && remaining < O.minEasyRunMinutes * easyCaps.length) {
        const minLong = minMinutes(longRuns[0].kind, longRuns[0].level);
        const shrink = round5(Math.min(O.minEasyRunMinutes * easyCaps.length - remaining, longRuns[0].minutes - minLong));
        if (shrink > 0) {
          longRuns[0] = { ...longRuns[0], minutes: longRuns[0].minutes - shrink };
          remaining += shrink;
        }
      }

      // Easy runs share what's left, each fitting its day and shorter than the long run.
      const longest = longRuns[0]?.minutes ?? Infinity;
      while (easyCaps.length > 0 && remaining / easyCaps.length < O.minEasyRunMinutes) easyCaps = easyCaps.slice(0, -1);
      const easyRuns: OutlineRun[] = [];
      easyCaps.forEach((cap, e) => {
        const minutes = round5(Math.min(remaining / (easyCaps.length - e), cap, longest));
        if (minutes < O.minEasyRunMinutes) return;
        const kind: RunKind = e === 0 && stridesWeek ? "strides" : easyKind;
        const level = kind === "run_walk" ? Math.max(1, runWalkLevel) : kind === "strides" ? levelFor("strides") : 1;
        easyRuns.push({ role: "easy", kind, level, minutes });
        remaining -= minutes;
      });

      // Leftover minutes go to the long run if it has room; otherwise the week is a little shorter.
      if (remaining >= 5 && longRuns.length > 0) {
        const shareCap = target * maxLongShare(input, runs, backToBack) - (longRuns[1]?.minutes ?? 0);
        const room = Math.min(longRunCap(input), longCaps[0], shareCap) - longRuns[0].minutes;
        const extra = Math.floor(Math.min(remaining, room) / 5) * 5;
        if (extra > 0) longRuns = [{ ...longRuns[0], minutes: longRuns[0].minutes + extra }, ...longRuns.slice(1)];
      }
      // The week can come out shorter than planned when days are short, so
      // trim the long run until it is within its share of what was planned.
      const maxShare = maxLongShare(input, runs, backToBack);
      const total = () => sum(out) + sum(longRuns) + sum(easyRuns);
      while (longRuns.length > 0 && sum(longRuns) > total() * maxShare && longRuns[0].minutes - 5 >= Math.max(...easyRuns.map((r) => r.minutes), minMinutes(longRuns[0].kind, longRuns[0].level))) {
        longRuns[0] = { ...longRuns[0], minutes: longRuns[0].minutes - 5 };
      }
      if (target - total() >= 10 && phase !== "recovery" && phase !== "taper") limitedByTime = true;
      return [...out, ...longRuns, ...easyRuns];
    };

    // Keep enough running easy: drop the second quality, then soften the
    // long run, then the last quality session, until the easy share is met.
    const easyTarget = isUltra ? O.easyShare.ultra : O.easyShare.default;
    let qualityKinds = quality;
    let long = longKind;
    let weekRuns = allocate(qualityKinds, long);
    while (easyShareOf(weekRuns) < easyTarget) {
      if (qualityKinds.length > 1) qualityKinds = qualityKinds.slice(0, 1);
      else if (long !== "long_easy" && long !== "long_hilly" && long !== "run_walk") long = "long_easy";
      else if (qualityKinds.length === 1) qualityKinds = [];
      else break;
      weekRuns = allocate(qualityKinds, long);
    }

    // ----- strength -----
    const focuses =
      phase === "taper" && weeksOut === 0
        ? (["upper"] as BodyFocus[])
        : FOCUS_PATTERNS[Math.min(lifts, 4)] ?? [];
    const effort: StrengthEffort =
      phase === "recovery" || phase === "taper" ? "light" : beginner && i < 4 ? "technique" : "hard";
    let strength: OutlineStrength[] = focuses.map((focus) => ({
      focus,
      variant: i % 2 === 0 ? "A" : "B",
      effort,
      minutes: strengthMin,
    }));

    // Recovery and taper weeks must also cut total load (checker: recovery 70%, taper 60/80/90%).
    let runMinutes = sum(weekRuns);
    const totalCap =
      phase === "recovery" && lastBuild
        ? lastBuild.total * O.recoveryTotalShare
        : phase === "taper" && lastBuild
          ? lastBuild.total * O.taperShares[weeksOut!]
          : Infinity;
    while (runMinutes + strength.length * strengthMin > totalCap && strength.length > 0) {
      strength = strength.slice(0, -1);
    }
    if (runMinutes + strength.length * strengthMin > totalCap) {
      const scale = totalCap / runMinutes;
      weekRuns = weekRuns.map((r) => ({ ...r, minutes: Math.max(O.minEasyRunMinutes, Math.floor((r.minutes * scale) / 5) * 5) }));
      runMinutes = sum(weekRuns);
    }
    const strengthMinutes = strength.length * strengthMin;

    // ----- bookkeeping for rotation and progression -----
    if (qualityKinds.length > 0) qPointer += 1;
    if (fullLevel && phase !== "base" && !backToBack && !beginner) lPointer += 1;
    for (const r of weekRuns) {
      lastLevel.set(r.kind, r.level);
      if (fullLevel && r.kind !== "run_walk") uses.set(r.kind, (uses.get(r.kind) ?? 0) + 1);
    }
    if (phase !== "recovery") nonRecoveryWeeks++;
    if (phase !== "recovery" && phase !== "taper") lastBuild = { run: runMinutes, total: runMinutes + strengthMinutes };

    weeks.push({
      weekNumber: i + 1,
      weekStart: addDays(input.startDate, i * 7),
      phase,
      block,
      runMinutes,
      strengthMinutes,
      runs: weekRuns,
      strength,
    });
    if (phase === "recovery") block++;
    prevRun = runMinutes;
  }

  const biggest = Math.max(...weeks.map((w) => w.runMinutes));
  if (limitedByTime && input.goalType === "race" && biggest < peakCap * 0.8) {
    notes.push(`Your available time limits running to about ${biggest} minutes a week, below the usual peak of about ${peakCap} for this goal. Adding time on more days would help.`);
  }
  return { weeks, taperWeeks: taper, notes };
}

const sum = (runs: OutlineRun[]) => runs.reduce((s, r) => s + r.minutes, 0);

/** Share of a week's running at easy effort, using the library's steps. */
export function easyShareOf(runs: OutlineRun[]): number {
  const total = sum(runs);
  if (total === 0) return 1;
  const easy = runs.reduce((s, r) => s + easyRunMinutes(asSession(r)), 0);
  return easy / total;
}

/** An outline run as a session, so it can be measured like a planned one. */
export function asSession(r: OutlineRun, date = "2026-01-05"): PlannedSession {
  return {
    date,
    slot: 1,
    type: "run",
    title: RUN_LIBRARY[r.kind].label,
    intensity: RUN_LIBRARY[r.kind].intensity,
    plannedMinutes: r.minutes,
    isKeySession: r.role !== "easy",
    steps: buildRunSteps(r.kind, r.level, r.minutes),
    kind: r.kind,
    level: r.level,
  };
}

/** The week's quality sessions, main one first, for the variety rule. */
export const qualityOf = (week: OutlineWeek) =>
  week.runs.filter((r) => r.role === "quality").map((r) => ({ kind: r.kind, level: r.level }));
