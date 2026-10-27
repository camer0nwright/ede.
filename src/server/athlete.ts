// Loads the current athlete and their active plan for the screens. "You" are
// the signed-in account; a plan made during setup but not yet claimed by an
// account is remembered by a device cookie and sent to sign-up. Without
// either, the screens show the demo athlete.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { pendingTokenHash, sessionAthleteId } from "@/server/auth";
import { db } from "@/lib/db";
import type { SavedAthlete } from "@/components/onboarding/draft";
import { sessionKey, type CheckIn } from "@/lib/checkin";
import { fromDbDate, rowToCheckIn, rowToWeekPlan } from "@/lib/db-mapping";
import { DEMO_ATHLETE, DEMO_TODAY, demoOutline, demoOutlineInput } from "@/lib/demo-athlete";
import type { BodyArea, Injury, StrengthVolume, WeekPlan } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import { adaptWeeksForInjury } from "@/lib/injury";
import { easeAfterSkips, easeBackOffer, easeBackStart, reviewWeek } from "@/lib/skips";
import { addDays } from "@/lib/dates";
import type { OutlineInput, PlanOutline } from "@/lib/plan-outline";
import { equipmentFromAnswers } from "@/lib/strength-builder";
import { buildPlanWeeks, type BuiltWeek, type WeekBuildInput } from "@/lib/week-builder";
import type { PaceOptions } from "@/lib/week-view";

/** A plan made during setup, before its account is created (see /signup). */
export const ATHLETE_COOKIE = "ede_athlete";

/**
 * Who "you" are: the signed-in athlete, or a plan made on this device that no
 * account has claimed yet. A claimed plan always needs a log-in.
 */
// Once per request: the page, its layout and the sidebar all ask.
export const currentAthlete = cache(loadCurrentAthlete);

async function loadCurrentAthlete(): Promise<{ id: string; signedIn: boolean } | null> {
  const signedIn = await sessionAthleteId();
  if (signedIn) return { id: signedIn, signedIn: true };
  const pending = (await cookies()).get(ATHLETE_COOKIE)?.value;
  if (!pending) return null;
  const athlete = await db.athlete.findUnique({ where: { pendingTokenHash: pendingTokenHash(pending) }, select: { id: true, email: true } });
  return athlete && !athlete.email ? { id: athlete.id, signedIn: false } : null;
}

export type PlanContext = {
  isDemo: boolean;
  athleteId?: string;
  /** The account's email, when signed in. */
  email?: string;
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
  /** Weights in kg or lb. */
  weightUnit: "kg" | "lb";
  /** Pace guides for run steps, when the athlete gave a recent 5K. */
  paces: PaceOptions;
  /** Weeks saved as they were when the plan was last rebuilt, so they don't change under you. */
  storedWeeks: WeekPlan[];
  /** The last week whose "ease back in" offer was answered. */
  reviewedWeekStart?: string;
  /** When the athlete agreed to ede. keeping injury details (SPEC decision 57). */
  healthConsentAt?: string;
  /** What the coach changed in each tailored week, and why, by week start. */
  weekSummaries: Record<string, string>;
  /** Check-ins by session key (date-slot). */
  checkIns: Record<string, CheckIn>;
  /** Gym workouts started or finished, by session key: where to open them. */
  workouts: Record<string, { id: string; inProgress: boolean }>;
  /** The active injury, if any: the plan adapts around it from the day it was reported. */
  injury?: ActiveInjury;
};

export type ActiveInjury = Injury & { id: string; notes: string | null; since: string };

/**
 * Every week of the plan with sessions on days (src/lib/week-builder.ts), as
 * stored once under way, adapted around an active injury, and eased after a
 * recent skip for illness or tiredness.
 */
export function builtWeeks(ctx: PlanContext): (BuiltWeek & { injured: boolean })[] {
  const adapted = adaptedWeeks(ctx);
  const eased = easeAfterSkips(
    adapted.map((b) => b.week),
    ctx.checkIns,
    ctx.today,
  );
  return adapted.map((b, i) => ({ ...b, week: eased[i] }));
}

function adaptedWeeks(ctx: PlanContext): (BuiltWeek & { injured: boolean })[] {
  const stored = new Map(ctx.storedWeeks.map((w) => [w.weekStart, w]));
  const weeks = buildPlanWeeks(ctx.outline, ctx.build).map((b) => {
    const week = stored.get(b.week.weekStart);
    return week ? { week, placed: true } : b;
  });
  if (!ctx.injury) return weeks.map((b) => ({ ...b, injured: false }));
  const adapted = adaptWeeksForInjury(
    weeks.map((b) => b.week),
    {
      injury: ctx.injury,
      since: ctx.injury.since,
      lastWeekRunMinutes: ctx.input.lastWeekRunMinutes,
      blocks: ctx.outline.weeks.map((w) => w.block),
      volume: ctx.input.strengthVolume,
      equipment: ctx.build.equipment,
      experienceLevel: ctx.input.experienceLevel,
    },
  );
  return weeks.map((b, i) => ({ ...b, ...adapted[i] }));
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
  paces: { fiveKSeconds: 25 * 60, unit: "km" },
  storedWeeks: [],
  weightUnit: "kg",
  checkIns: {},
  workouts: {},
  weekSummaries: {},
});

/** Today's date at request time (not when the page is pre-built). */
async function requestDate() {
  await connection();
  return new Date().toISOString().slice(0, 10);
}

/** The plan the screens show. Loaded once per request, however many parts of the page ask. */
export function getPlanContext(opts: { demo?: boolean } = {}): Promise<PlanContext> {
  return opts.demo ? Promise.resolve(demoContext()) : loadPlanContext();
}

const loadPlanContext = cache(async (): Promise<PlanContext> => {
  const who = await currentAthlete();
  if (!who) return demoContext();
  // A plan nobody has claimed yet: create the account to see it.
  if (!who.signedIn) redirect("/signup");
  const id = who.id;

  const athlete = await db.athlete.findUnique({
    where: { id },
    include: {
      outlines: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
      injuries: { where: { resolvedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
      weeks: { include: { sessions: { include: { runLog: true } } }, orderBy: { weekStart: "asc" } },
    },
  });
  const current = athlete?.outlines[0];
  if (!athlete || !current) return demoContext();

  const input = JSON.parse(current.input) as OutlineInput;
  const injury = athlete.injuries[0];
  const equipment = (athlete.equipment ?? "Full gym").split(", ");
  const ultra = athlete.raceDistance === "ultra" && athlete.ultraDistanceKm ? `${Math.round(athlete.ultraDistanceKm)}K ultra` : null;
  const title =
    athlete.goalType === "race"
      ? (ultra ?? RACE_TITLE[athlete.raceDistance ?? ""] ?? "Race")
      : athlete.goalType === "strength"
        ? "Strength focus"
        : "General fitness";
  return {
    isDemo: false,
    athleteId: athlete.id,
    email: athlete.email ?? undefined,
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
    build: buildInput(input, equipment, injury?.area as BodyArea | undefined),
    paces: {
      fiveKSeconds: athlete.recent5kMinutes ? Math.round(athlete.recent5kMinutes * 60) : undefined,
      unit: athlete.distanceUnit === "mi" ? "mi" : "km",
    },
    storedWeeks: athlete.weeks.map(rowToWeekPlan),
    weekSummaries: Object.fromEntries(athlete.weeks.flatMap((w) => (w.summary ? [[fromDbDate(w.weekStart), w.summary]] : []))),
    weightUnit: athlete.weightUnit === "lb" ? "lb" : "kg",
    ...(athlete.reviewedWeekStart && { reviewedWeekStart: fromDbDate(athlete.reviewedWeekStart) }),
    ...(athlete.healthConsentAt && { healthConsentAt: athlete.healthConsentAt.toISOString().slice(0, 10) }),
    checkIns: Object.fromEntries(
      athlete.weeks.flatMap((w) =>
        w.sessions.flatMap((row) => {
          const c = rowToCheckIn(row);
          return c ? [[sessionKey(fromDbDate(row.date), row.slot), c]] : [];
        }),
      ),
    ),
    workouts: Object.fromEntries(
      athlete.weeks.flatMap((w) =>
        w.sessions
          .filter((row) => row.type === "strength" && (row.status === "in_progress" || row.status === "completed"))
          .map((row) => [sessionKey(fromDbDate(row.date), row.slot), { id: row.id, inProgress: row.status === "in_progress" }]),
      ),
    ),
    ...(injury && {
      injury: {
        id: injury.id,
        area: injury.area as Injury["area"],
        painLevel: injury.painLevel,
        painWhen: injury.painWhen as Injury["painWhen"],
        notes: injury.notes,
        since: injury.startedAt.toISOString().slice(0, 10),
      },
    }),
  };
});

/** The current athlete's saved settings, for editing a section in the You section. Null for the demo. */
export async function getSavedAthlete(): Promise<{ id: string; saved: SavedAthlete } | null> {
  const who = await currentAthlete();
  if (!who?.signedIn) return null;
  const id = who.id;
  const a = await db.athlete.findUnique({
    where: { id },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" } },
      injuries: { where: { resolvedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  if (!a || a.availability.length !== 7) return null;
  const injury = a.injuries[0];
  return {
    id,
    saved: {
      ...a,
      targetDate: a.targetDate ? fromDbDate(a.targetDate) : null,
      availability: a.availability.map((d) => ({ minutes: d.minutes, isDouble: d.isDouble, secondMinutes: d.secondMinutes })),
      injury: injury
        ? {
            area: injury.area as Injury["area"],
            painLevel: injury.painLevel,
            painWhen: injury.painWhen as Injury["painWhen"],
            notes: injury.notes,
          }
        : null,
    },
  };
}

/** Past injuries, most recent first. */
export async function getInjuryHistory(athleteId: string) {
  const rows = await db.injury.findMany({ where: { athleteId, resolvedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 10 });
  return rows.map((r) => ({
    id: r.id,
    area: r.area as Injury["area"],
    painLevel: r.painLevel,
    since: r.startedAt.toISOString().slice(0, 10),
    until: r.resolvedAt!.toISOString().slice(0, 10),
  }));
}

/**
 * The "ease back in" offer for last week, if it's due: last week is over,
 * was mostly missed, and hasn't been answered yet (SPEC decision 50).
 */
export function easeBack(ctx: PlanContext) {
  if (ctx.isDemo) return null;
  const weeks = builtWeeks(ctx);
  const index = weeks.findIndex((b) => b.week.weekStart <= ctx.today && ctx.today <= addDays(b.week.weekStart, 6));
  if (index < 1) return null;
  const last = weeks[index - 1].week;
  if (ctx.reviewedWeekStart && ctx.reviewedWeekStart >= last.weekStart) return null;
  // While injured, the injury adapts the plan instead.
  if (weeks[index - 1].injured || ctx.injury) return null;
  const review = reviewWeek(last, ctx.checkIns);
  const offer = easeBackOffer(review);
  if (!offer) return null;
  const thisWeek = weeks[index].week;
  return {
    ...offer,
    review,
    thisWeek,
    start: easeBackStart(thisWeek, ctx.checkIns, ctx.storedWeeks.some((w) => w.weekStart === thisWeek.weekStart)),
  };
}
