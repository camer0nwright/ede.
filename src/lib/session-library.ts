// The session library: every kind of run ede. can plan, its progression
// levels, and how to turn a kind + level + duration into steps.
// Efforts are RPE (1-10); pace targets come later (v2).
import type { Intensity, RunKind, RunStep } from "./domain";

export type RunRole = "easy" | "quality" | "long";

type Reps = { reps: number; work: number; rest: number }; // minutes

type KindSpec = {
  label: string;
  role: RunRole;
  intensity: Intensity;
  /**
   * For each level (index 0 = level 1): the main set's description, total
   * minutes, minutes of actual hard work, and for reps the easy recovery
   * between them (shown as its own step, so it counts as easy running).
   */
  levels: { main: string; minutes: number; work: number; rpe: number; recovery?: string }[];
  /** Easy warm-up and cool-down around the main set (quality sessions). */
  warmup?: number;
  cooldown?: number;
};

const reps = (r: Reps[], effort: string, restLabel: string, rpe: number) =>
  r.map(({ reps, work, rest }) => ({
    main: `${reps} × ${fmt(work)} ${effort}`,
    recovery: `${fmt(rest)} ${restLabel} after each rep`,
    minutes: reps * (work + rest),
    work: reps * work,
    rpe,
  }));

const continuous = (mins: number[], effort: string, rpe: number) =>
  mins.map((m) => ({ main: `${m} min ${effort}`, minutes: m, work: m, rpe }));

function fmt(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} s`;
  return Number.isInteger(min) ? `${min} min` : `${Math.floor(min)} min ${Math.round((min % 1) * 60)} s`;
}

export const RUN_LIBRARY: Record<RunKind, KindSpec> = {
  easy: {
    label: "Easy run",
    role: "easy",
    intensity: "easy",
    levels: [{ main: "Easy running, conversational pace", minutes: 0, work: 0, rpe: 3 }],
  },
  recovery: {
    label: "Recovery run",
    role: "easy",
    intensity: "easy",
    levels: [{ main: "Very easy running, shorter than usual", minutes: 0, work: 0, rpe: 2 }],
  },
  strides: {
    label: "Easy run with strides",
    role: "easy",
    intensity: "easy",
    // Strides are short and relaxed-fast; the jog-back recovery is easy.
    levels: [4, 6, 8].map((n) => ({
      main: `${n} × 20 s strides (relaxed, fast), walk or jog back`,
      minutes: Math.ceil((n * 20) / 60),
      work: (n * 20) / 60,
      rpe: 7,
    })),
  },
  run_walk: {
    label: "Run/walk",
    role: "easy",
    intensity: "easy",
    // Beginners: progress the run:walk ratio, then run continuously.
    levels: [
      [1, 1],
      [2, 1],
      [3, 1],
      [5, 1],
      [8, 1],
      [0, 0],
    ].map(([run, walk]) => ({
      main: run ? `Run ${run} min, walk ${walk} min, repeat` : "Easy continuous running",
      minutes: 0,
      work: 0,
      rpe: 4,
    })),
  },
  long_easy: {
    label: "Long run",
    role: "long",
    intensity: "easy",
    levels: [{ main: "Easy, conversational pace throughout", minutes: 0, work: 0, rpe: 4 }],
  },
  long_fast_finish: {
    label: "Long run, fast finish",
    role: "long",
    intensity: "moderate",
    levels: continuous([10, 15, 20, 25], "fast finish, strong but controlled", 7),
  },
  long_race_pace: {
    label: "Long run with race-pace sections",
    role: "long",
    intensity: "moderate",
    levels: reps(
      [
        { reps: 2, work: 10, rest: 5 },
        { reps: 2, work: 15, rest: 5 },
        { reps: 3, work: 15, rest: 5 },
        { reps: 2, work: 25, rest: 5 },
      ],
      "at goal race effort",
      "easy",
      6,
    ),
  },
  long_hilly: {
    label: "Long hilly run",
    role: "long",
    intensity: "easy",
    levels: [{ main: "Easy on hilly terrain; power hike the steep climbs", minutes: 0, work: 0, rpe: 4 }],
  },
  intervals_short: {
    label: "Short intervals",
    role: "quality",
    intensity: "hard",
    warmup: 12,
    cooldown: 8,
    levels: reps(
      [
        { reps: 6, work: 1, rest: 1 },
        { reps: 8, work: 1, rest: 1 },
        { reps: 10, work: 1, rest: 1 },
        { reps: 6, work: 2, rest: 1 },
        { reps: 8, work: 2, rest: 1 },
        { reps: 6, work: 3, rest: 1.5 },
      ],
      "hard",
      "easy jog",
      9,
    ),
  },
  intervals_long: {
    label: "Long intervals",
    role: "quality",
    intensity: "hard",
    warmup: 12,
    cooldown: 8,
    levels: reps(
      [
        { reps: 4, work: 3, rest: 2 },
        { reps: 5, work: 3, rest: 2 },
        { reps: 4, work: 4, rest: 2 },
        { reps: 5, work: 4, rest: 2 },
        { reps: 5, work: 5, rest: 2 },
        { reps: 4, work: 7, rest: 2 },
      ],
      "hard, about 10K effort",
      "easy jog",
      8,
    ),
  },
  tempo: {
    label: "Tempo run",
    role: "quality",
    intensity: "moderate",
    warmup: 12,
    cooldown: 8,
    levels: continuous([12, 15, 18, 20, 25, 30], "at tempo effort, comfortably hard", 7),
  },
  hills: {
    label: "Hill repeats",
    role: "quality",
    intensity: "hard",
    warmup: 12,
    cooldown: 8,
    levels: reps(
      [
        { reps: 6, work: 0.75, rest: 1.5 },
        { reps: 8, work: 0.75, rest: 1.5 },
        { reps: 10, work: 0.75, rest: 1.5 },
        { reps: 6, work: 1.5, rest: 2 },
        { reps: 8, work: 1.5, rest: 2 },
      ],
      "hard uphill",
      "jog back down",
      9,
    ),
  },
  fartlek: {
    label: "Fartlek",
    role: "quality",
    intensity: "hard",
    warmup: 10,
    cooldown: 8,
    levels: reps(
      [
        { reps: 6, work: 1, rest: 2 },
        { reps: 8, work: 1, rest: 2 },
        { reps: 6, work: 2, rest: 2 },
        { reps: 8, work: 2, rest: 2 },
        { reps: 6, work: 3, rest: 2 },
      ],
      "fast",
      "easy",
      7,
    ),
  },
  progression: {
    label: "Progression run",
    role: "quality",
    intensity: "moderate",
    warmup: 15,
    cooldown: 5,
    levels: continuous([10, 15, 20, 25], "building steadily to strong", 7),
  },
  aerobic_power: {
    label: "Steady aerobic run",
    role: "quality",
    intensity: "moderate",
    warmup: 12,
    cooldown: 8,
    levels: continuous([20, 25, 30, 35, 40], "steady, just below threshold", 6),
  },
  hill_hike: {
    label: "Uphill power hiking",
    role: "quality",
    intensity: "moderate",
    warmup: 12,
    cooldown: 8,
    levels: reps(
      [
        { reps: 4, work: 4, rest: 3 },
        { reps: 5, work: 4, rest: 3 },
        { reps: 6, work: 4, rest: 3 },
        { reps: 5, work: 6, rest: 3 },
        { reps: 6, work: 6, rest: 3 },
      ],
      "power hiking uphill, hands on knees if steep",
      "easy jog or walk down",
      6,
    ),
  },
};

export const maxLevel = (kind: RunKind) => RUN_LIBRARY[kind].levels.length;

const clampLevel = (kind: RunKind, level: number) =>
  Math.min(Math.max(1, Math.round(level)), maxLevel(kind));

/** Shortest sensible session for a kind at a level, in whole minutes. */
export function minMinutes(kind: RunKind, level: number): number {
  const spec = RUN_LIBRARY[kind];
  const main = spec.levels[clampLevel(kind, level) - 1].minutes;
  if (spec.role === "quality") return Math.ceil((spec.warmup ?? 0) + main + (spec.cooldown ?? 0));
  if (kind === "strides") return 20;
  if (spec.role === "long") return Math.max(45, Math.ceil(main) + 30);
  return 20;
}

/**
 * Builds the steps for one run. Step minutes add up to `minutes`; any time
 * beyond the main set goes into easy running.
 */
export function buildRunSteps(kind: RunKind, level: number, minutes: number): RunStep[] {
  const spec = RUN_LIBRARY[kind];
  const l = spec.levels[clampLevel(kind, level) - 1];

  // The main set: hard work, plus (for reps) the easy recovery between reps as its own step.
  const main: RunStep[] = l.recovery
    ? [
        { name: l.main, minutes: l.work, targetRpe: l.rpe },
        { name: l.recovery, minutes: l.minutes - l.work, targetRpe: 2 },
      ]
    : [{ name: l.main, minutes: l.minutes, targetRpe: l.rpe }];

  if (spec.role === "quality") {
    const warmup = spec.warmup ?? 10;
    const cooldown = Math.max(minutes - warmup - l.minutes, 0);
    return [
      { name: "Warm-up: easy jog", minutes: warmup, targetRpe: 3 },
      ...main,
      ...(cooldown > 0 ? [{ name: "Cool-down: easy jog", minutes: cooldown, targetRpe: 3 }] : []),
    ];
  }

  if (l.minutes === 0) return [{ name: l.main, minutes, targetRpe: l.rpe }];

  // Easy or long run with a harder part at the end (strides, fast finish, race pace).
  const easy = Math.max(minutes - l.minutes, 0);
  return [
    { name: spec.role === "long" ? "Easy, conversational pace" : "Easy running", minutes: easy, targetRpe: spec.role === "long" ? 4 : 3 },
    ...main,
  ];
}

export const runLabel = (kind: RunKind) => RUN_LIBRARY[kind].label;
