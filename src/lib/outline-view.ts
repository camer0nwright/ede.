// Turns plan outline weeks into display items for the screens.
import type { BodyFocus, Intensity, RunStep, StrengthVolume } from "./domain";
import type { OutlineWeek, StrengthEffort } from "./plan-outline";
import { buildRunSteps, maxLevel, RUN_LIBRARY } from "./session-library";

export type SessionItem =
  | {
      id: string;
      type: "run";
      title: string;
      role: "quality" | "long" | "easy";
      minutes: number;
      intensity: Intensity;
      level?: number;
      maxLevel?: number;
      backToBack: boolean;
      steps: RunStep[];
    }
  | {
      id: string;
      type: "strength";
      title: string;
      minutes: number;
      intensity: Intensity;
      focus: BodyFocus;
      effort: StrengthEffort;
      variant: "A" | "B";
      summary: string;
    };

const FOCUS_LABEL: Record<BodyFocus, string> = {
  upper: "Upper body",
  lower: "Lower body",
  full: "Full body",
};

const EFFORT_SUMMARY: Record<StrengthEffort, string> = {
  hard: "Hard working sets close to your limit",
  light: "Lighter week: same lifts, well short of your limit",
  technique: "Learning the movements: controlled reps, moderate effort",
};

const VOLUME_SUMMARY: Record<StrengthVolume, string> = {
  low: "3-5 exercises, 2 working sets each",
  moderate: "4-6 exercises, 3 working sets each",
  high: "5-7 exercises, 3-4 working sets each",
};

const ROLE_ORDER = { quality: 0, long: 1, easy: 2 } as const;

export function sessionItems(week: OutlineWeek, strengthVolume: StrengthVolume): SessionItem[] {
  const runs = [...week.runs]
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
    .map((r, i): SessionItem => {
      const spec = RUN_LIBRARY[r.kind];
      const levels = maxLevel(r.kind);
      return {
        id: `run-${i}`,
        type: "run",
        title: r.backToBack ? "Back-to-back long run" : spec.label,
        role: r.role,
        minutes: r.minutes,
        intensity: spec.intensity,
        ...(levels > 1 && { level: r.level, maxLevel: levels }),
        backToBack: r.backToBack ?? false,
        steps: buildRunSteps(r.kind, r.level, r.minutes),
      };
    });
  const lifts = week.strength.map((s, i): SessionItem => ({
    id: `lift-${i}`,
    type: "strength",
    title: FOCUS_LABEL[s.focus],
    minutes: s.minutes,
    intensity: s.effort === "hard" ? "hard" : "easy",
    focus: s.focus,
    effort: s.effort,
    variant: s.variant,
    summary: `${VOLUME_SUMMARY[strengthVolume]}. ${EFFORT_SUMMARY[s.effort]}.`,
  }));
  return [...runs, ...lifts];
}
