// Tunable numbers for the plan checker rules. Change them here, not in the rules.
import { INJURY_BANDS } from "@/lib/injury";

export const CHECKER_CONFIG = {
  /** At least this share of weekly running minutes must be in easy runs. */
  minEasyRunShare: 0.8,

  // A run counts as a long run from 60 minutes: LONG_RUN_MIN_MINUTES in src/lib/key-runs.ts.
  /** Lower-body lifting the day after a hard or long run is capped at this RPE. */
  maxLowerRpeAfterKeyRun: 8,

  /** Run minutes may grow by this share over the last build week... */
  maxRunIncreaseShare: 0.1,
  /** ...or this many minutes, whichever is larger (helps low-volume athletes). */
  minRunIncreaseMinutes: 20,

  /** Starting load applies when last week's run minutes are below this, or unknown. */
  startingLoadBelowMinutes: 60,
  /** Starting load: run minutes for beginners (run/walk) and everyone else. */
  startingRunMinutes: {
    beginner: { min: 40, max: 60 },
    other: { min: 60, max: 90 },
  },
  /** Starting load is split across this many runs. */
  startingRunSessions: { min: 2, max: 3 },

  /** A recovery week must be at most this share of the last build week (30%+ cut). */
  maxRecoveryWeekShare: 0.7,
  /** A recovery week is due after this many build weeks in a row. */
  maxBuildWeeksInRow: 3,
  /** A recovery week is too soon before this many build weeks in a row. */
  minBuildWeeksBeforeRecovery: 2,

  /**
   * Taper load caps as a share of the last full week, by weeks out from the
   * target date: index 0 is race week. 100-mile ultras get a 3-week taper.
   */
  taperShares: [0.6, 0.8],
  longUltraTaperShares: [0.6, 0.8, 0.9],
  /** Ultras of at least this distance count as 100-mile races. */
  longUltraMinKm: 160,

  /** Working sets per exercise for each strength volume setting. */
  workingSets: {
    low: { min: 2, max: 2 },
    moderate: { min: 3, max: 3 },
    high: { min: 3, max: 4 },
  },
  /** Lowest working-set RPE that counts as hard for each strength volume setting. */
  hardLiftMinRpe: { low: 8.5, moderate: 8, high: 7.5 },
  /** More than this share of a session's exercises must be hard ("most lifts are hard"). */
  minHardExerciseShare: 0.5,

  /** Heavy barbell lifts stay at or below this RPE: never to failure. */
  maxBarbellRpe: 9,

  /** Injury bands by pain level (SPEC: prompts/plan-engine.md, Injury and pain handling). Shared with the plan. */
  injury: INJURY_BANDS,

  /** Recalculation cap: sessions that may be added or made harder at once. */
  maxSessionsIncreasedPerRecalc: 3,
  /** Recalculation cap: weekly minutes may grow by at most this share. */
  maxRecalcLoadIncreaseShare: 0.1,

  // The top availability option ("2h+", or "6h+" for ultras) has no upper limit: see dayCap in src/lib/domain.ts.
} as const;
