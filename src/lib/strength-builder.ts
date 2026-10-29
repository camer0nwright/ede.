// Builds the exercises for a strength session from the exercise library:
// what to do, how many sets, reps and how hard, fitted to the athlete's
// equipment, strength volume and injuries. See SPEC "Strength volume setting"
// and "Gym sessions and logging".
import type { BodyArea, BodyFocus, Equipment, StrengthExercise, StrengthVolume } from "./domain";
import {
  defaultRestSeconds,
  failureAllowed,
  findExercise,
  type ExerciseInfo,
} from "./exercise-library";
import type { StrengthEffort } from "./plan-outline";

type SlotRole = "main" | "accessory" | "isolation" | "core";
type Slot = { role: SlotRole; candidates: string[] };

const CORE: Slot = { role: "core", candidates: ["Pallof press", "Dead bug", "Plank", "Hanging knee raise"] };

/** Exercise slots for each focus, most important first. */
const TEMPLATES: Record<BodyFocus, Slot[]> = {
  lower: [
    { role: "main", candidates: ["Back squat", "Front squat", "Hack squat", "Leg press", "Goblet squat", "Bulgarian split squat", "Bodyweight squat"] },
    { role: "main", candidates: ["Romanian deadlift", "Trap bar deadlift", "Deadlift", "Hip thrust", "Dumbbell Romanian deadlift", "Single-leg Romanian deadlift", "Glute bridge"] },
    { role: "accessory", candidates: ["Bulgarian split squat", "Reverse lunge", "Step-up", "Split squat"] },
    { role: "isolation", candidates: ["Seated leg curl", "Lying leg curl", "Nordic curl", "Single-leg Romanian deadlift"] },
    { role: "isolation", candidates: ["Standing calf raise", "Seated calf raise", "Single-leg calf raise", "Hip abduction", "Banded lateral walk"] },
    CORE,
    { role: "isolation", candidates: ["Leg extension", "Spanish squat", "Wall sit"] },
    { role: "accessory", candidates: ["Hip thrust", "Glute bridge", "Single-leg Romanian deadlift"] },
  ],
  upper: [
    { role: "main", candidates: ["Bench press", "Dumbbell bench press", "Machine chest press", "Push-up"] },
    { role: "main", candidates: ["Pull-up", "Lat pulldown", "Assisted pull-up", "Inverted row", "Band row"] },
    { role: "accessory", candidates: ["Seated cable row", "Chest-supported row", "Barbell row", "Single-arm dumbbell row", "Inverted row", "Band row"] },
    { role: "accessory", candidates: ["Overhead press", "Dumbbell shoulder press", "Machine shoulder press", "Pike push-up"] },
    { role: "isolation", candidates: ["Dumbbell lateral raise", "Cable lateral raise", "Face pull", "Reverse fly", "Band pull-apart"] },
    CORE,
    { role: "isolation", candidates: ["Dumbbell curl", "Cable curl"] },
    { role: "isolation", candidates: ["Triceps pushdown", "Overhead triceps extension"] },
  ],
  full: [
    { role: "main", candidates: ["Trap bar deadlift", "Back squat", "Goblet squat", "Leg press", "Dumbbell Romanian deadlift", "Bodyweight squat"] },
    { role: "main", candidates: ["Bench press", "Dumbbell bench press", "Machine chest press", "Push-up"] },
    { role: "main", candidates: ["Pull-up", "Lat pulldown", "Assisted pull-up", "Inverted row", "Band row"] },
    { role: "accessory", candidates: ["Reverse lunge", "Bulgarian split squat", "Step-up", "Split squat"] },
    { role: "accessory", candidates: ["Dumbbell shoulder press", "Machine shoulder press", "Seated cable row", "Pike push-up"] },
    CORE,
    { role: "isolation", candidates: ["Face pull", "Dumbbell lateral raise", "Band pull-apart"] },
    { role: "isolation", candidates: ["Dumbbell curl", "Triceps pushdown", "Cable curl"] },
  ],
};

/**
 * Exercises per session for each strength volume (SPEC decision 74): Low 3-4,
 * Moderate 5-6, Higher 7-8. Every exercise has 2 working sets, so the volume
 * setting only changes how many exercises there are. Sessions start at the top
 * of the range and drop to the bottom to fit the day's time.
 */
export const EXERCISE_COUNT: Record<StrengthVolume, { min: number; max: number }> = {
  low: { min: 3, max: 4 },
  moderate: { min: 5, max: 6 },
  high: { min: 7, max: 8 },
};

/** Every exercise, at every volume: two all-out working sets (SPEC decision 74). */
export const WORKING_SETS = 2;

/** What onboarding's equipment answers make available. */
export const EQUIPMENT_FROM_ANSWERS: Record<string, Equipment[]> = {
  "Full gym": ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"],
  "Barbell and plates": ["barbell", "bodyweight"],
  Dumbbells: ["dumbbell", "bodyweight"],
  "Machines and cables": ["machine", "cable", "bodyweight"],
  "Resistance bands": ["band", "bodyweight"],
  "Bodyweight only": ["bodyweight"],
};

export function equipmentFromAnswers(answers: string[]): Equipment[] {
  const set = new Set<Equipment>(["bodyweight"]);
  for (const a of answers) for (const e of EQUIPMENT_FROM_ANSWERS[a] ?? []) set.add(e);
  return [...set];
}

export type StrengthRequest = {
  focus: BodyFocus;
  volume: StrengthVolume;
  effort: StrengthEffort;
  equipment: Equipment[];
  /** Main lifts stay the same within a block and change between blocks. */
  block: number;
  /** Accessories alternate week to week. */
  variant: "A" | "B";
  /** Body area to avoid (an active injury). */
  avoid?: BodyArea;
  /** Beginners start on machines and dumbbells rather than heavy barbell lifts. */
  avoidBarbell?: boolean;
  /** The day after a hard or long run, lower-body work stays at or below this RPE. */
  maxLowerRpe?: number;
  /** Time available; exercises are dropped from the end to fit. */
  maxMinutes?: number;
  /** Fewest exercises to keep when trimming for time (default 2; light weeks may go to 1). */
  minExercises?: number;
};

export type BuiltExercise = StrengthExercise & { restSeconds: number; isMainLift: boolean };

export type BuiltSession = { exercises: BuiltExercise[]; minutes: number };

const isCoreHold = (name: string) => name === "Plank" || name === "Dead bug";

/** Reps that make sense for the exercise itself, before the usual rules. */
const SPECIAL_REPS: Record<string, string> = { "Nordic curl": "4-6", "Wall sit": "30-45s" };

function reps(info: ExerciseInfo, role: SlotRole, volume: StrengthVolume): string {
  if (SPECIAL_REPS[info.name]) return SPECIAL_REPS[info.name];
  // Unloaded leg exercises need more reps to be hard enough.
  if (info.equipment === "bodyweight" && info.isLowerBody) return info.category === "isolation" ? "15-20" : "12-20";
  if (role === "core") return isCoreHold(info.name) ? "30-45s" : info.name === "Pallof press" ? "10 each side" : "10-12";
  if (role === "main") return volume === "high" ? "6-8" : volume === "moderate" ? "6" : "5";
  if (info.category === "isolation") return "10-15";
  return "8-10";
}

/**
 * How hard the working sets are (SPEC decision 74), on the effort scale the
 * plan checker uses (10 = failure): all-out by default, so to failure, except
 * heavy barbell compound lifts, which stop one rep short. Core holds are hard
 * but controlled. Light weeks, a beginner's technique weeks, and leg work the
 * day after a hard or long run stay easier.
 */
function targetRpe(info: ExerciseInfo, role: SlotRole, req: StrengthRequest): number {
  let rpe: number;
  if (req.effort === "light") rpe = 7;
  else if (req.effort === "technique") rpe = 6.5;
  else if (role === "core") rpe = 9;
  else rpe = failureAllowed(info) ? 10 : 9;
  // The day after a hard or long run, a leg session stays easier throughout, core included.
  if ((info.isLowerBody || role === "core") && req.maxLowerRpe !== undefined) rpe = Math.min(rpe, req.maxLowerRpe);
  return rpe;
}

const usable = (name: string, req: StrengthRequest): ExerciseInfo | undefined => {
  const info = findExercise(name);
  if (!info) return undefined;
  if (!req.equipment.includes(info.equipment)) return undefined;
  if (req.avoid && info.loads.includes(req.avoid)) return undefined;
  if (req.avoidBarbell && info.equipment === "barbell") return undefined;
  return info;
};

/** Minutes for a session: warm-up sets, then each working set plus its rest, plus a few minutes to set up. */
export function sessionMinutes(exercises: BuiltExercise[]): number {
  const seconds = exercises.reduce((sum, e) => sum + e.warmupSets * 90 + e.workingSets * (45 + e.restSeconds), 0);
  return Math.round(seconds / 60) + 5;
}

export function buildStrengthSession(req: StrengthRequest): BuiltSession {
  const used = new Set<string>();
  const warmedUp = new Set<string>();
  const exercises: BuiltExercise[] = [];
  for (const slot of TEMPLATES[req.focus]) {
    if (exercises.length >= EXERCISE_COUNT[req.volume].max) break;
    const options = slot.candidates.map((n) => usable(n, req)).filter((e): e is ExerciseInfo => !!e && !used.has(e.name));
    if (options.length === 0) continue;
    // Main lifts change only between blocks; accessories alternate A/B.
    const mainChoices = options.filter((e) => e.isMainLift);
    const pick =
      slot.role === "main"
        ? (mainChoices.length > 0 ? mainChoices : options)[(req.block - 1) % Math.min(2, (mainChoices.length > 0 ? mainChoices : options).length)]
        : options[req.variant === "B" && options.length > 1 ? 1 : 0];
    used.add(pick.name);
    const rpe = targetRpe(pick, slot.role, req);
    // One warm-up set before the first exercise for each muscle group, if it's loaded.
    const warmUp = slot.role !== "core" && pick.equipment !== "bodyweight" && pick.equipment !== "band" && !warmedUp.has(pick.muscleGroup);
    warmedUp.add(pick.muscleGroup);
    exercises.push({
      name: pick.name,
      warmupSets: warmUp ? 1 : 0,
      workingSets: WORKING_SETS,
      reps: reps(pick, slot.role, req.volume),
      targetRpe: rpe,
      failureAllowed: failureAllowed(pick) && rpe >= 10,
      restSeconds: defaultRestSeconds(pick),
      isMainLift: slot.role === "main",
    });
  }
  // Fit the time available by dropping the least important exercises: down to
  // the bottom of the volume's range, or further (to 2) if the day is short.
  const keep = req.minExercises ?? 2;
  while (req.maxMinutes !== undefined && exercises.length > keep && sessionMinutes(exercises) > req.maxMinutes) exercises.pop();
  return { exercises, minutes: sessionMinutes(exercises) };
}
