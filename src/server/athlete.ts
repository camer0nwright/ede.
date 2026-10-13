// Loads the current athlete and their active plan for the screens. Until
// sign-in exists, a cookie remembers which athlete "you" are; without one,
// the screens show the demo athlete.
import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { DEMO_ATHLETE, DEMO_TODAY, demoOutline, demoOutlineInput } from "@/lib/demo-athlete";
import type { BodyArea, StrengthVolume } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import type { OutlineInput, PlanOutline } from "@/lib/plan-outline";
import { equipmentFromAnswers } from "@/lib/strength-builder";
import { buildPlanWeeks, type BuiltWeek, type WeekBuildInput } from "@/lib/week-builder";

export const ATHLETE_COOKIE = "ede_athlete";

export type PlanContext = {
  isDemo: boolean;
  name: string;
  goal: string;
  title: string;
  input: OutlineInput;
  outline: PlanOutline;
  strengthVolume: StrengthVolume;
  /** "Today" as YYYY-MM-DD: fixed for the demo, the real date otherwise. */
  today: string;
  /** What the week builder needs: availability, equipment and any injured area. */
  build: WeekBuildInput;
};

/** Every week of the plan with sessions on days (src/lib/week-builder.ts). */
export function builtWeeks(ctx: PlanContext): BuiltWeek[] {
  return buildPlanWeeks(ctx.outline, ctx.build);
}

const buildInput = (input: OutlineInput, equipment: string[], avoid?: BodyArea): WeekBuildInput => ({
  availability: input.availability,
  ultra: input.raceDistance === "ultra",
  strengthVolume: input.strengthVolume,
  experienceLevel: input.experienceLevel,
  equipment: equipmentFromAnswers(equipment),
  ...(avoid && { avoid }),
});

const RACE_TITLE: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  half: "Half marathon",
  marathon: "Marathon",
  ultra: "Ultra",
};

const demoContext = (): PlanContext => ({
  isDemo: true,
  name: DEMO_ATHLETE.name,
  goal: DEMO_ATHLETE.goal,
  title: DEMO_ATHLETE.raceName,
  input: demoOutlineInput,
  outline: demoOutline,
  strengthVolume: demoOutlineInput.strengthVolume,
  today: DEMO_TODAY,
  build: buildInput(demoOutlineInput, ["Full gym"]),
});

/** Today's date at request time (not when the page is pre-built). */
async function requestDate() {
  await connection();
  return new Date().toISOString().slice(0, 10);
}

export async function getPlanContext(): Promise<PlanContext> {
  const id = (await cookies()).get(ATHLETE_COOKIE)?.value;
  if (!id) return demoContext();

  const athlete = await db.athlete.findUnique({
    where: { id },
    include: {
      outlines: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
      injuries: { where: { resolvedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  const current = athlete?.outlines[0];
  if (!athlete || !current) return demoContext();

  const input = JSON.parse(current.input) as OutlineInput;
  const ultra = athlete.raceDistance === "ultra" && athlete.ultraDistanceKm ? `${Math.round(athlete.ultraDistanceKm)}K ultra` : null;
  const title =
    athlete.goalType === "race"
      ? (ultra ?? RACE_TITLE[athlete.raceDistance ?? ""] ?? "Race")
      : athlete.goalType === "strength"
        ? "Strength focus"
        : "General fitness";
  return {
    isDemo: false,
    name: athlete.name || "You",
    goal:
      athlete.goalType === "race"
        ? athlete.targetTimeSeconds
          ? `Target ${formatDuration(athlete.targetTimeSeconds)}`
          : athlete.justFinish
            ? "Just finish"
            : (athlete.goalDetail ?? "Build to race day")
        : (athlete.goalDetail ?? "Train consistently"),
    title,
    input,
    outline: JSON.parse(current.outline) as PlanOutline,
    strengthVolume: athlete.strengthVolume as StrengthVolume,
    today: await requestDate(),
    build: buildInput(input, (athlete.equipment ?? "Full gym").split(", "), athlete.injuries[0]?.area as BodyArea | undefined),
  };
}
