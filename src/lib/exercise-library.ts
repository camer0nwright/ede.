// The exercise library: every exercise ede. plans, with what the plan checker
// and gym logger need to know about it. Code is the source of truth; the seed
// script copies it into the database so set logs can reference exercises.
import type { BodyArea, Equipment } from "./domain";

export type ExerciseCategory = "compound" | "isolation";

export type ExerciseInfo = {
  name: string;
  /** Other names the AI might use, matched case-insensitively. */
  aliases?: string[];
  muscleGroup: string;
  equipment: Equipment;
  category: ExerciseCategory;
  isLowerBody: boolean;
  /** A main lift stays the same within a training block (SPEC decision 10). */
  isMainLift?: boolean;
  /** Body areas this exercise loads heavily, for injury rules. */
  loads: BodyArea[];
  /** Exercises to swap to, e.g. for different equipment or an injury. */
  alternatives: string[];
};

const ex = (e: ExerciseInfo) => e;

export const EXERCISES: ExerciseInfo[] = [
  // ----- Lower body: main lifts -----
  ex({ name: "Back squat", aliases: ["Barbell squat", "Squat"], muscleGroup: "Quads", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["knee", "back", "hip"], alternatives: ["Leg press", "Goblet squat", "Hack squat"] }),
  ex({ name: "Front squat", muscleGroup: "Quads", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["knee", "back"], alternatives: ["Goblet squat", "Leg press"] }),
  ex({ name: "Deadlift", aliases: ["Conventional deadlift"], muscleGroup: "Posterior chain", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["back", "hip"], alternatives: ["Trap bar deadlift", "Romanian deadlift"] }),
  ex({ name: "Trap bar deadlift", aliases: ["Hex bar deadlift"], muscleGroup: "Posterior chain", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["back", "hip", "knee"], alternatives: ["Deadlift", "Leg press"] }),
  ex({ name: "Romanian deadlift", aliases: ["RDL"], muscleGroup: "Hamstrings", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["back", "hip"], alternatives: ["Dumbbell Romanian deadlift", "Hip thrust", "Seated leg curl"] }),
  ex({ name: "Hip thrust", aliases: ["Barbell hip thrust"], muscleGroup: "Glutes", equipment: "barbell", category: "compound", isLowerBody: true, isMainLift: true, loads: ["hip"], alternatives: ["Glute bridge", "Cable pull-through"] }),

  // ----- Lower body: accessories -----
  ex({ name: "Leg press", muscleGroup: "Quads", equipment: "machine", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Hack squat", "Goblet squat"] }),
  ex({ name: "Hack squat", muscleGroup: "Quads", equipment: "machine", category: "compound", isLowerBody: true, loads: ["knee"], alternatives: ["Leg press", "Goblet squat"] }),
  ex({ name: "Goblet squat", muscleGroup: "Quads", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Leg press", "Box squat"] }),
  ex({ name: "Box squat", muscleGroup: "Quads", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Goblet squat", "Leg press"] }),
  ex({ name: "Bulgarian split squat", aliases: ["Rear-foot elevated split squat"], muscleGroup: "Quads", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Reverse lunge", "Leg press"] }),
  ex({ name: "Reverse lunge", aliases: ["Lunge", "Walking lunge"], muscleGroup: "Quads", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Bulgarian split squat", "Step-up"] }),
  ex({ name: "Step-up", aliases: ["Box step-up"], muscleGroup: "Quads", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["knee"], alternatives: ["Reverse lunge", "Leg press"] }),
  ex({ name: "Dumbbell Romanian deadlift", aliases: ["DB RDL"], muscleGroup: "Hamstrings", equipment: "dumbbell", category: "compound", isLowerBody: true, loads: ["back", "hip"], alternatives: ["Romanian deadlift", "Seated leg curl"] }),
  ex({ name: "Glute bridge", muscleGroup: "Glutes", equipment: "bodyweight", category: "compound", isLowerBody: true, loads: ["hip"], alternatives: ["Hip thrust", "Cable pull-through"] }),
  ex({ name: "Cable pull-through", muscleGroup: "Glutes", equipment: "cable", category: "compound", isLowerBody: true, loads: ["hip"], alternatives: ["Hip thrust", "Glute bridge"] }),
  ex({ name: "Seated leg curl", aliases: ["Leg curl", "Hamstring curl"], muscleGroup: "Hamstrings", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Lying leg curl", "Nordic curl"] }),
  ex({ name: "Lying leg curl", muscleGroup: "Hamstrings", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Seated leg curl"] }),
  ex({ name: "Nordic curl", aliases: ["Nordic hamstring curl"], muscleGroup: "Hamstrings", equipment: "bodyweight", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Seated leg curl"] }),
  ex({ name: "Leg extension", muscleGroup: "Quads", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Leg press", "Spanish squat"] }),
  ex({ name: "Spanish squat", muscleGroup: "Quads", equipment: "band", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Leg extension", "Wall sit"] }),
  ex({ name: "Wall sit", muscleGroup: "Quads", equipment: "bodyweight", category: "isolation", isLowerBody: true, loads: ["knee"], alternatives: ["Spanish squat"] }),
  ex({ name: "Standing calf raise", aliases: ["Calf raise"], muscleGroup: "Calves", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["ankle"], alternatives: ["Seated calf raise", "Single-leg calf raise"] }),
  ex({ name: "Seated calf raise", muscleGroup: "Calves", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["ankle"], alternatives: ["Standing calf raise"] }),
  ex({ name: "Single-leg calf raise", muscleGroup: "Calves", equipment: "bodyweight", category: "isolation", isLowerBody: true, loads: ["ankle"], alternatives: ["Standing calf raise"] }),
  ex({ name: "Hip abduction", aliases: ["Abductor machine"], muscleGroup: "Glutes", equipment: "machine", category: "isolation", isLowerBody: true, loads: ["hip"], alternatives: ["Banded lateral walk"] }),
  ex({ name: "Banded lateral walk", muscleGroup: "Glutes", equipment: "band", category: "isolation", isLowerBody: true, loads: ["hip"], alternatives: ["Hip abduction"] }),

  // ----- Upper body: main lifts -----
  ex({ name: "Bench press", aliases: ["Barbell bench press"], muscleGroup: "Chest", equipment: "barbell", category: "compound", isLowerBody: false, isMainLift: true, loads: ["shoulder", "elbow"], alternatives: ["Dumbbell bench press", "Machine chest press", "Push-up"] }),
  ex({ name: "Overhead press", aliases: ["Barbell overhead press", "Military press", "OHP"], muscleGroup: "Shoulders", equipment: "barbell", category: "compound", isLowerBody: false, isMainLift: true, loads: ["shoulder", "back"], alternatives: ["Dumbbell shoulder press", "Machine shoulder press"] }),
  ex({ name: "Pull-up", aliases: ["Pull-ups", "Chin-up", "Chin-ups"], muscleGroup: "Back", equipment: "bodyweight", category: "compound", isLowerBody: false, isMainLift: true, loads: ["shoulder", "elbow"], alternatives: ["Lat pulldown", "Assisted pull-up"] }),
  ex({ name: "Barbell row", aliases: ["Bent-over row"], muscleGroup: "Back", equipment: "barbell", category: "compound", isLowerBody: false, isMainLift: true, loads: ["back"], alternatives: ["Chest-supported row", "Seated cable row"] }),

  // ----- Upper body: accessories -----
  ex({ name: "Dumbbell bench press", muscleGroup: "Chest", equipment: "dumbbell", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Bench press", "Machine chest press"] }),
  ex({ name: "Incline dumbbell press", muscleGroup: "Chest", equipment: "dumbbell", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dumbbell bench press", "Machine chest press"] }),
  ex({ name: "Machine chest press", muscleGroup: "Chest", equipment: "machine", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dumbbell bench press", "Push-up"] }),
  ex({ name: "Push-up", aliases: ["Press-up", "Push-ups"], muscleGroup: "Chest", equipment: "bodyweight", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Machine chest press", "Dumbbell bench press"] }),
  ex({ name: "Dumbbell shoulder press", muscleGroup: "Shoulders", equipment: "dumbbell", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Machine shoulder press", "Overhead press"] }),
  ex({ name: "Machine shoulder press", muscleGroup: "Shoulders", equipment: "machine", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dumbbell shoulder press"] }),
  ex({ name: "Lat pulldown", muscleGroup: "Back", equipment: "cable", category: "compound", isLowerBody: false, loads: ["shoulder", "elbow"], alternatives: ["Pull-up", "Assisted pull-up"] }),
  ex({ name: "Assisted pull-up", muscleGroup: "Back", equipment: "machine", category: "compound", isLowerBody: false, loads: ["shoulder", "elbow"], alternatives: ["Lat pulldown"] }),
  ex({ name: "Seated cable row", aliases: ["Cable row"], muscleGroup: "Back", equipment: "cable", category: "compound", isLowerBody: false, loads: ["back"], alternatives: ["Chest-supported row", "Barbell row"] }),
  ex({ name: "Chest-supported row", aliases: ["Chest-supported dumbbell row"], muscleGroup: "Back", equipment: "dumbbell", category: "compound", isLowerBody: false, loads: [], alternatives: ["Seated cable row", "Single-arm dumbbell row"] }),
  ex({ name: "Single-arm dumbbell row", aliases: ["Dumbbell row"], muscleGroup: "Back", equipment: "dumbbell", category: "compound", isLowerBody: false, loads: ["back"], alternatives: ["Chest-supported row", "Seated cable row"] }),
  ex({ name: "Dumbbell lateral raise", aliases: ["Lateral raise"], muscleGroup: "Shoulders", equipment: "dumbbell", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Cable lateral raise"] }),
  ex({ name: "Cable lateral raise", muscleGroup: "Shoulders", equipment: "cable", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dumbbell lateral raise"] }),
  ex({ name: "Face pull", muscleGroup: "Rear shoulders", equipment: "cable", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Reverse fly"] }),
  ex({ name: "Reverse fly", aliases: ["Rear delt fly"], muscleGroup: "Rear shoulders", equipment: "dumbbell", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Face pull"] }),
  ex({ name: "Dumbbell curl", aliases: ["Bicep curl", "Biceps curl"], muscleGroup: "Biceps", equipment: "dumbbell", category: "isolation", isLowerBody: false, loads: ["elbow"], alternatives: ["Cable curl"] }),
  ex({ name: "Cable curl", muscleGroup: "Biceps", equipment: "cable", category: "isolation", isLowerBody: false, loads: ["elbow"], alternatives: ["Dumbbell curl"] }),
  ex({ name: "Triceps pushdown", aliases: ["Cable pushdown", "Tricep pushdown"], muscleGroup: "Triceps", equipment: "cable", category: "isolation", isLowerBody: false, loads: ["elbow"], alternatives: ["Overhead triceps extension"] }),
  ex({ name: "Overhead triceps extension", muscleGroup: "Triceps", equipment: "dumbbell", category: "isolation", isLowerBody: false, loads: ["elbow", "shoulder"], alternatives: ["Triceps pushdown"] }),

  // ----- Bodyweight and band options (for home or minimal equipment) -----
  ex({ name: "Bodyweight squat", aliases: ["Air squat"], muscleGroup: "Quads", equipment: "bodyweight", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Goblet squat", "Wall sit"] }),
  ex({ name: "Split squat", aliases: ["Static lunge"], muscleGroup: "Quads", equipment: "bodyweight", category: "compound", isLowerBody: true, loads: ["knee", "hip"], alternatives: ["Bulgarian split squat", "Reverse lunge"] }),
  ex({ name: "Single-leg Romanian deadlift", aliases: ["Single-leg RDL"], muscleGroup: "Hamstrings", equipment: "bodyweight", category: "compound", isLowerBody: true, loads: ["hip"], alternatives: ["Dumbbell Romanian deadlift", "Glute bridge"] }),
  ex({ name: "Inverted row", aliases: ["Bodyweight row"], muscleGroup: "Back", equipment: "bodyweight", category: "compound", isLowerBody: false, loads: [], alternatives: ["Seated cable row", "Band row"] }),
  ex({ name: "Pike push-up", muscleGroup: "Shoulders", equipment: "bodyweight", category: "compound", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dumbbell shoulder press"] }),
  ex({ name: "Band row", muscleGroup: "Back", equipment: "band", category: "compound", isLowerBody: false, loads: [], alternatives: ["Seated cable row", "Inverted row"] }),
  ex({ name: "Band pull-apart", muscleGroup: "Rear shoulders", equipment: "band", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Face pull", "Reverse fly"] }),

  // ----- Core -----
  ex({ name: "Plank", muscleGroup: "Core", equipment: "bodyweight", category: "isolation", isLowerBody: false, loads: [], alternatives: ["Dead bug"] }),
  ex({ name: "Dead bug", muscleGroup: "Core", equipment: "bodyweight", category: "isolation", isLowerBody: false, loads: [], alternatives: ["Plank"] }),
  ex({ name: "Pallof press", muscleGroup: "Core", equipment: "cable", category: "isolation", isLowerBody: false, loads: [], alternatives: ["Plank"] }),
  ex({ name: "Hanging knee raise", aliases: ["Hanging leg raise"], muscleGroup: "Core", equipment: "bodyweight", category: "isolation", isLowerBody: false, loads: ["shoulder"], alternatives: ["Dead bug"] }),
];

/**
 * Failure (RPE 10) is allowed only on machine, cable or isolation exercises,
 * never on heavy barbell lifts (SPEC: Strength volume setting).
 */
/**
 * Whether an exercise may be taken to true failure (SPEC decision 74): anything
 * except heavy barbell compound lifts (squats, deadlifts, bench and similar),
 * which stop one rep short. Isolation work with a barbell (curls) is fine.
 */
export const failureAllowed = (e: ExerciseInfo) => e.equipment !== "barbell" || e.category === "isolation";

/** Seconds of rest between sets, by type of exercise (SPEC: Gym sessions and logging). */
export const defaultRestSeconds = (e: ExerciseInfo) =>
  e.category === "isolation" ? 75 : e.equipment === "barbell" ? 180 : 120;

/** Smallest weight step in kg (barbell plates, dumbbell jumps, machine stack). */
export const weightStepKg = (e: ExerciseInfo) =>
  e.equipment === "bodyweight" || e.equipment === "band" ? 0 : e.equipment === "dumbbell" ? 2 : 2.5;

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // "Seated leg curl (machine)" → "seated leg curl"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BY_NAME = new Map<string, ExerciseInfo>();
for (const e of EXERCISES) {
  for (const n of [e.name, ...(e.aliases ?? [])]) BY_NAME.set(normalise(n), e);
}

/** Finds an exercise by its name or an alias; undefined if it isn't in the library. */
export const findExercise = (name: string) => BY_NAME.get(normalise(name));
