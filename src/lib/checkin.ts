// Check-ins: marking a session done (time, effort, notes, and distance for
// runs) or skipped with a reason (SPEC: Session check-in, Skip workout).
// Shared by the browser (to guide) and the server (which validates again).
import { z } from "zod";
import { IsoDate } from "./domain";
import { warningWords } from "./onboarding";

export const SKIP_REASONS = ["injury", "illness", "holiday", "work_life", "fatigue", "other"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];
export const SKIP_LABEL: Record<SkipReason, string> = {
  injury: "Injury or pain",
  illness: "Ill",
  holiday: "Holiday or travel",
  work_life: "Work or life",
  fatigue: "Too tired",
  other: "Something else",
};

const where = { date: IsoDate, slot: z.union([z.literal(1), z.literal(2)]) };
const notes = z.string().trim().max(1000).optional();

export const CheckInInput = z.discriminatedUnion("status", [
  z.object({
    ...where,
    status: z.literal("completed"),
    actualMinutes: z.number().int().min(1, "Enter how long it took").max(1440),
    effort: z.number().int().min(1).max(10),
    /** In the athlete's unit (km or miles); runs only. */
    distance: z.number().positive().max(500).optional(),
    notes,
  }),
  z.object({ ...where, status: z.literal("skipped"), skipReason: z.enum(SKIP_REASONS), notes }),
]);
export type CheckInInput = z.infer<typeof CheckInInput>;

/** A check-in as the screens show it. Distance is in km. */
export type CheckIn =
  | { status: "completed"; actualMinutes: number; effort: number; distanceKm?: number; notes?: string }
  | { status: "skipped"; skipReason: SkipReason; notes?: string };

export const sessionKey = (date: string, slot: number) => `${date}-${slot}`;

export const EFFORT_LABEL: Record<number, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Easy",
  4: "Comfortable",
  5: "Steady",
  6: "Steady",
  7: "Hard",
  8: "Very hard",
  9: "Very hard",
  10: "All out",
};

/** Cautious advice for what someone wrote, or null. Chest pain or dizziness means a doctor; pain means report it. */
export function checkInCaution(text: string | undefined): string | null {
  const words = warningWords(text);
  if (words.some((w) => ["chest", "dizzy", "dizziness", "faint", "fainted", "breathless", "numb"].includes(w))) {
    return "Chest pain, dizziness, fainting, numbness or unusual breathlessness need checking by a doctor before you train again.";
  }
  if (words.length > 0) return "If something hurts, report it as an injury in You so ede. can adapt your plan around it.";
  return null;
}

/** Sessions done out of those due so far (up to and including today), for the progress summary. */
export function progressSummary(dueKeys: string[], checkIns: Record<string, CheckIn>) {
  const done = dueKeys.filter((k) => checkIns[k]?.status === "completed").length;
  const skipped = dueKeys.filter((k) => checkIns[k]?.status === "skipped").length;
  return { due: dueKeys.length, done, skipped };
}
