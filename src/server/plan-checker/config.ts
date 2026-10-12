// Tunable numbers for the plan checker rules. Change them here, not in the rules.
export const CHECKER_CONFIG = {
  /** At least this share of weekly running minutes must be in easy runs. */
  minEasyRunShare: 0.8,

  /** A build week may add this share of load over the last build week... */
  maxLoadIncreaseShare: 0.1,
  /** ...or this many minutes, whichever is larger (helps low-volume athletes). */
  minLoadIncreaseMinutes: 20,

  /** A recovery week must be at most this share of the last build week. */
  maxRecoveryWeekShare: 0.8,
  /** A recovery week is due after this many build weeks in a row. */
  maxBuildWeeksInRow: 3,
  /** A recovery week is too soon before this many build weeks in a row. */
  minBuildWeeksBeforeRecovery: 2,

  /** Taper: the week before race week, and race week itself, as a share of the last full week. */
  maxTaperWeekShare: 0.8,
  maxRaceWeekShare: 0.6,

  /** Recalculation cap: sessions that may be added or made harder at once. */
  maxSessionsIncreasedPerRecalc: 3,
  /** Recalculation cap: weekly minutes may grow by at most this share. */
  maxRecalcLoadIncreaseShare: 0.1,

  /** Availability of 120 minutes means "120+", so it has no upper limit. */
  openEndedMinutes: 120,
} as const;
