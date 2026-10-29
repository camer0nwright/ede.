// Editing one section of a saved plan (the You section). Only that section's
// answers change; everything else comes from what's saved, so a tampered
// request can't change other settings.
import type { OnboardingAnswers } from "./onboarding";

export const SECTION_FIELDS = {
  goal: ["goalType", "raceDistance", "ultraDistanceKm", "terrain", "elevationGainM", "targetDate", "targetTimeSeconds", "justFinish", "goalDetail"],
  training: ["experienceLevel", "recent5kSeconds", "runsPerWeek", "liftsPerWeek"],
  lifting: ["strengthVolume", "gymSplit", "equipment"],
  week: ["availability"],
} as const satisfies Record<string, readonly (keyof OnboardingAnswers)[]>;
export type SettingsSection = keyof typeof SECTION_FIELDS;

/** The saved answers with one section replaced by the edited one. Fields left out of the edit are cleared. */
export function mergeSection(saved: Record<string, unknown>, edited: Record<string, unknown>, section: SettingsSection): Record<string, unknown> {
  const merged = { ...saved };
  for (const field of SECTION_FIELDS[section]) {
    if (edited[field] === undefined) delete merged[field];
    else merged[field] = edited[field];
  }
  return merged;
}
