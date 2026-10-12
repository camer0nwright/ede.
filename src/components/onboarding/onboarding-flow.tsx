"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { saveOnboarding } from "@/app/onboarding/actions";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_AREAS,
  type Availability,
  type BodyArea,
  type ExperienceLevel,
  type GoalType,
  type Injury,
  type PainWhen,
  type RaceDistance,
  type StrengthVolume,
  type Terrain,
} from "@/lib/domain";
import { formatDate, formatDayMinutes, formatDuration, plural } from "@/lib/format";
import {
  cautionFor,
  desiredTimeNote,
  EQUIPMENT_OPTIONS,
  LAST_WEEK_RUN_OPTIONS,
  OnboardingAnswers,
  planStartDate,
  quickWeekToAvailability,
  recommendedVolume,
  strengthVolumeNote,
  targetDateProblem,
  ULTRA_PRESETS,
  weekFitProblem,
  type QuickWeek,
} from "@/lib/onboarding";
import { recommendedSessions } from "@/lib/plan-outline";
import { Chip, Field, Note, OptionCard } from "./choices";
import { WeekPlanner } from "./week-planner";

type Draft = {
  name: string;
  goalType?: GoalType;
  raceDistance?: RaceDistance;
  ultraDistanceKm?: number;
  terrain: Terrain;
  elevationGainM?: number;
  targetDate: string;
  /** Desired time as typed: hours (or minutes for 5K/10K) and the next unit down. */
  timeBig: string;
  timeSmall: string;
  justFinish: boolean;
  goalDetail: string;
  experienceLevel?: ExperienceLevel;
  lastWeekRunMinutes?: number;
  /** Unset until chosen; the recommended value is used meanwhile. */
  runsPerWeek?: number;
  liftsPerWeek?: number;
  strengthVolume?: StrengthVolume;
  quick: QuickWeek;
  equipment: (typeof EQUIPMENT_OPTIONS)[number][];
  hasInjury?: boolean;
  injury: Injury & { notes: string };
  injuryHistory: string;
  availability: Availability;
  weightUnit: "kg" | "lb";
  distanceUnit: "km" | "mi";
};

const START_WEEK: QuickWeek = { days: [1, 2, 3, 5, 6], weekdayMinutes: 45, weekendMinutes: 90 };

const START: Draft = {
  name: "",
  terrain: "road",
  targetDate: "",
  timeBig: "",
  timeSmall: "",
  justFinish: false,
  goalDetail: "",
  equipment: [],
  injury: { area: "knee", painLevel: 2, painWhen: "running", notes: "" },
  injuryHistory: "",
  quick: START_WEEK,
  availability: quickWeekToAvailability(START_WEEK),
  weightUnit: "kg",
  distanceUnit: "km",
};

const STEPS = ["welcome", "goal", "experience", "strength", "injury", "week", "you", "review"] as const;
type Step = (typeof STEPS)[number];

const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "half", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "ultra", label: "Ultra" },
];

const PAIN_WHEN: { value: PainWhen; label: string }[] = [
  { value: "running", label: "When running" },
  { value: "lifting_only", label: "Only when lifting" },
  { value: "walking", label: "When walking" },
  { value: "resting", label: "At rest or at night" },
];

const today = () => new Date().toISOString().slice(0, 10);

/** 5K and 10K times are minutes:seconds; longer races are hours:minutes. */
const shortRace = (d: Draft) => d.raceDistance === "5k" || d.raceDistance === "10k";

function targetSeconds(d: Draft): number | undefined {
  const big = Number(d.timeBig || 0);
  const small = Number(d.timeSmall || 0);
  const seconds = shortRace(d) ? big * 60 + small : big * 3600 + small * 60;
  return seconds > 0 ? seconds : undefined;
}

/** Choices the user hasn't made yet fall back to the recommendation. */
function effective(d: Draft) {
  const rec = recommendedSessions({
    goalType: d.goalType ?? "general",
    raceDistance: d.raceDistance,
    experienceLevel: d.experienceLevel ?? "intermediate",
    strengthVolume: d.strengthVolume ?? "moderate",
  });
  const runs = d.runsPerWeek ?? rec.runs;
  const recVolume = recommendedVolume({ experienceLevel: d.experienceLevel, raceDistance: d.raceDistance, runsPerWeek: runs });
  return { runs, lifts: d.liftsPerWeek ?? rec.lifts, rec, recVolume, volume: d.strengthVolume ?? recVolume };
}

/** The draft as the answers the server expects (validation happens there too). */
function toAnswers(d: Draft) {
  const race = d.goalType === "race";
  return {
    ...(d.name.trim() && { name: d.name.trim() }),
    goalType: d.goalType,
    ...(race && { raceDistance: d.raceDistance }),
    ...(race && d.raceDistance === "ultra" && { ultraDistanceKm: d.ultraDistanceKm, terrain: d.terrain, ...(d.elevationGainM !== undefined && { elevationGainM: d.elevationGainM }) }),
    ...(race && d.targetDate && { targetDate: d.targetDate }),
    ...(race && (d.justFinish ? { justFinish: true } : { targetTimeSeconds: targetSeconds(d) })),
    ...(!race && d.goalDetail.trim() && { goalDetail: d.goalDetail.trim() }),
    experienceLevel: d.experienceLevel,
    lastWeekRunMinutes: d.lastWeekRunMinutes,
    runsPerWeek: effective(d).runs,
    liftsPerWeek: effective(d).lifts,
    strengthVolume: effective(d).volume,
    equipment: d.equipment,
    ...(d.hasInjury && { injury: { ...d.injury, notes: d.injury.notes.trim() || undefined } }),
    ...(d.injuryHistory.trim() && { injuryHistory: d.injuryHistory.trim() }),
    availability: d.availability,
    weightUnit: d.weightUnit,
    distanceUnit: d.distanceUnit,
  };
}

/** What's missing before the user can leave a step, or null when it's complete. */
function stepProblem(step: Step, d: Draft): string | null {
  switch (step) {
    case "goal":
      if (!d.goalType) return "Choose a goal";
      if (d.goalType === "race") {
        if (!d.raceDistance) return "Choose a race distance";
        if (d.raceDistance === "ultra" && !d.ultraDistanceKm) return "Enter the ultra's distance";
        if (!d.targetDate) return "Enter your race date";
        const dateProblem = targetDateProblem(d.targetDate, today());
        if (dateProblem) return dateProblem;
        if (!d.justFinish && !targetSeconds(d)) return "Enter a desired time, or choose just finish";
      }
      return null;
    case "experience":
      if (!d.experienceLevel) return "Choose your experience";
      if (d.lastWeekRunMinutes === undefined) return "Choose roughly how much you ran last week";
      return null;
    case "strength":
      return d.equipment.length === 0 ? "Pick the equipment you can use" : null;
    case "injury":
      return d.hasInjury === undefined ? "Let us know if anything hurts" : null;
    case "week": {
      const days = d.availability.filter((x) => x.minutes !== null).length;
      if (days < 2) return "Choose at least 2 training days";
      if (days > 6) return "Keep at least 1 full rest day";
      return weekFitProblem(d.availability, effective(d).runs, effective(d).lifts) ? "Make room for your sessions to continue" : null;
    }
    default:
      return null;
  }
}

export function OnboardingFlow() {
  const [draft, setDraft] = useState<Draft>(START);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const step = STEPS[stepIndex];
  const problem = stepProblem(step, draft);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const ultra = draft.goalType === "race" && draft.raceDistance === "ultra";

  // Start each step at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  const answers = useMemo(() => toAnswers(draft), [draft]);
  const eff = effective(draft);
  const volumeNote = strengthVolumeNote({ strengthVolume: eff.volume, raceDistance: draft.raceDistance, experienceLevel: draft.experienceLevel, runsPerWeek: eff.runs });
  const timeNote = draft.justFinish ? null : desiredTimeNote(draft.raceDistance, targetSeconds(draft), draft.experienceLevel);
  const caution = cautionFor({ injury: draft.hasInjury ? draft.injury : undefined, injuryHistory: draft.injuryHistory });

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));
  const build = () => {
    const parsed = OnboardingAnswers.safeParse(answers);
    if (!parsed.success) return setErrors(parsed.error.issues.map((i) => i.message));
    setErrors([]);
    startTransition(async () => {
      const result = await saveOnboarding(parsed.data);
      if (result && !result.ok) setErrors(result.errors);
    });
  };

  return (
    <div className="-mb-24 flex min-h-dvh flex-col pt-4 pb-6">
      {step !== "welcome" && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={back} className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length - 1} aria-valuenow={stepIndex}>
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-xs text-muted-foreground">
            {stepIndex}/{STEPS.length - 1}
          </span>
        </div>
      )}

      <div key={step} className="mt-6 flex flex-1 flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
        {step === "welcome" && (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <Logo />
            <h1 className="font-display text-6xl leading-[0.9] uppercase">Run and lift, as one plan</h1>
            <p className="text-lg text-muted-foreground">
              ede. builds your weekly running and lifting together, so they help each other instead of clashing. It
              adapts as your weeks go.
            </p>
            <p className="text-sm text-muted-foreground">About 3 minutes to set up.</p>
            <MedicalNotice />
          </div>
        )}

        {step === "goal" && (
          <>
            <Heading title="What are you training for?" />
            <div className="flex flex-col gap-2">
              <OptionCard selected={draft.goalType === "race"} onClick={() => update({ goalType: "race" })} title="A race" description="From 5K to ultra, with a plan that builds to race day." />
              <OptionCard selected={draft.goalType === "strength"} onClick={() => update({ goalType: "strength" })} title="Getting stronger" description="More lifting, with running to keep you fit." />
              <OptionCard selected={draft.goalType === "general"} onClick={() => update({ goalType: "general" })} title="General fitness" description="A balanced mix that keeps building, block by block." />
            </div>
            {draft.goalType === "race" && (
              <>
                <Field label="Race distance">
                  <div className="flex flex-wrap gap-2">
                    {DISTANCES.map((x) => (
                      <Chip key={x.value} selected={draft.raceDistance === x.value} onClick={() => update({ raceDistance: x.value })}>
                        {x.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                {ultra && (
                  <>
                    <Field label="Ultra distance">
                      <div className="flex flex-wrap gap-2">
                        {ULTRA_PRESETS.map((p) => (
                          <Chip key={p.km} selected={draft.ultraDistanceKm === p.km} onClick={() => update({ ultraDistanceKm: p.km })}>
                            {p.label}
                          </Chip>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        Or enter it:
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={43}
                          max={500}
                          className="w-24"
                          value={draft.ultraDistanceKm ?? ""}
                          onChange={(e) => update({ ultraDistanceKm: e.target.value ? Number(e.target.value) : undefined })}
                          aria-label="Ultra distance in km"
                        />
                        km
                      </label>
                    </Field>
                    <Field label="Terrain">
                      <div className="flex flex-wrap gap-2">
                        {(["road", "trail", "mountain"] as const).map((t) => (
                          <Chip key={t} selected={draft.terrain === t} onClick={() => update({ terrain: t })}>
                            {t[0].toUpperCase() + t.slice(1)}
                          </Chip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Elevation gain (optional)">
                      <label className="flex items-center gap-2 text-sm">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="w-28"
                          value={draft.elevationGainM ?? ""}
                          onChange={(e) => update({ elevationGainM: e.target.value ? Number(e.target.value) : undefined })}
                          aria-label="Elevation gain in metres"
                        />
                        metres
                      </label>
                    </Field>
                  </>
                )}
                <Field label="Race date">
                  <Input type="date" value={draft.targetDate} min={planStartDate(today())} onChange={(e) => update({ targetDate: e.target.value })} className="w-48" />
                </Field>
                {draft.raceDistance && (
                  <Field label="Desired time" hint="ede. uses this to set the right sessions and efforts.">
                    <div className={`flex items-center gap-2 ${draft.justFinish ? "opacity-40" : ""}`}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="w-20 text-center"
                        value={draft.timeBig}
                        disabled={draft.justFinish}
                        onChange={(e) => update({ timeBig: e.target.value })}
                        aria-label={shortRace(draft) ? "Minutes" : "Hours"}
                        placeholder={shortRace(draft) ? "mm" : "h"}
                      />
                      <span className="font-display text-2xl">:</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={59}
                        className="w-20 text-center"
                        value={draft.timeSmall}
                        disabled={draft.justFinish}
                        onChange={(e) => update({ timeSmall: e.target.value })}
                        aria-label={shortRace(draft) ? "Seconds" : "Minutes"}
                        placeholder={shortRace(draft) ? "ss" : "mm"}
                      />
                      <span className="text-sm text-muted-foreground">{shortRace(draft) ? "min : sec" : "hours : min"}</span>
                    </div>
                    <div>
                      <Chip selected={draft.justFinish} onClick={() => update({ justFinish: !draft.justFinish })}>
                        Just finish
                      </Chip>
                    </div>
                    {timeNote && <Note>{timeNote}</Note>}
                  </Field>
                )}
              </>
            )}
            {draft.goalType && draft.goalType !== "race" && (
              <Field label="Anything specific? (optional)">
                <Input value={draft.goalDetail} onChange={(e) => update({ goalDetail: e.target.value })} placeholder={draft.goalType === "strength" ? "Squat 100 kg" : "Feel fitter and stronger"} maxLength={120} />
              </Field>
            )}
          </>
        )}

        {step === "experience" && (
          <>
            <Heading title="Where are you starting from?" />
            <div className="flex flex-col gap-2">
              <OptionCard selected={draft.experienceLevel === "beginner"} onClick={() => update({ experienceLevel: "beginner" })} title="Beginner" description="New to running, lifting, or both. We'll start gently with run/walk and simple lifts." />
              <OptionCard selected={draft.experienceLevel === "intermediate"} onClick={() => update({ experienceLevel: "intermediate" })} title="Intermediate" description="You run and lift fairly regularly and know the main lifts." />
              <OptionCard selected={draft.experienceLevel === "advanced"} onClick={() => update({ experienceLevel: "advanced" })} title="Advanced" description="Years of consistent training, and you've raced before." />
            </div>
            <Field label="Roughly how much did you run last week?">
              <div className="flex flex-wrap gap-2">
                {LAST_WEEK_RUN_OPTIONS.map((o) => (
                  <Chip key={o.label} selected={draft.lastWeekRunMinutes === o.minutes} onClick={() => update({ lastWeekRunMinutes: o.minutes })}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Runs a week in your plan" hint={`Recommended for your goal: ${eff.rec.runs}`}>
              <NumberRow min={1} max={6} value={eff.runs} recommended={eff.rec.runs} onChange={(n) => update({ runsPerWeek: n })} label="runs" />
            </Field>
            <Field label="Gym sessions a week" hint={`Recommended for your goal: ${eff.rec.lifts}`}>
              <NumberRow min={1} max={5} value={eff.lifts} recommended={eff.rec.lifts} onChange={(n) => update({ liftsPerWeek: n })} label="gym sessions" />
            </Field>
          </>
        )}

        {step === "strength" && (
          <>
            <Heading title="How much lifting?" sub="You can change this later in your profile." />
            <div className="flex flex-col gap-2">
              <OptionCard selected={eff.volume === "low"} onClick={() => update({ strengthVolume: "low" })} title="Low" badge={eff.recVolume === "low" ? "Recommended" : undefined} description="3-5 exercises, 2 hard working sets each, 30-45 min. Keeps your legs fresh for running." />
              <OptionCard selected={eff.volume === "moderate"} onClick={() => update({ strengthVolume: "moderate" })} title="Moderate" badge={eff.recVolume === "moderate" ? "Recommended" : undefined} description="4-6 exercises, 3 working sets each, 45-60 min. A solid balance of strength and running." />
              <OptionCard selected={eff.volume === "high"} onClick={() => update({ strengthVolume: "high" })} title="Higher" description="5-7 exercises, 3-4 working sets each, 60-75 min." />
            </div>
            {volumeNote && <Note>{volumeNote}</Note>}
            <Field label="What equipment can you use?">
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((e) => {
                  const on = draft.equipment.includes(e);
                  return (
                    <Chip key={e} selected={on} onClick={() => update({ equipment: on ? draft.equipment.filter((x) => x !== e) : [...draft.equipment, e] })}>
                      {e}
                    </Chip>
                  );
                })}
              </div>
            </Field>
          </>
        )}

        {step === "injury" && (
          <>
            <Heading title="Anything hurting right now?" sub="ede. adjusts your plan around pain and injuries." />
            <div className="flex gap-2">
              <Chip selected={draft.hasInjury === false} onClick={() => update({ hasInjury: false })} className="flex-1">
                No, all good
              </Chip>
              <Chip selected={draft.hasInjury === true} onClick={() => update({ hasInjury: true })} className="flex-1">
                Yes
              </Chip>
            </div>
            {draft.hasInjury && (
              <>
                <Field label="Where?">
                  <div className="flex flex-wrap gap-2">
                    {BODY_AREAS.map((a) => (
                      <Chip key={a} selected={draft.injury.area === a} onClick={() => update({ injury: { ...draft.injury, area: a as BodyArea } })}>
                        {a[0].toUpperCase() + a.slice(1)}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label={`How bad? ${draft.injury.painLevel} out of 10`}>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={draft.injury.painLevel}
                    onChange={(e) => update({ injury: { ...draft.injury, painLevel: Number(e.target.value) } })}
                    className="h-11 w-full accent-[var(--primary)]"
                    aria-label="Pain level from 0 to 10"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0 none</span>
                    <span>5 moderate</span>
                    <span>10 worst</span>
                  </div>
                </Field>
                <Field label="When does it hurt?">
                  <div className="flex flex-wrap gap-2">
                    {PAIN_WHEN.map((p) => (
                      <Chip key={p.value} selected={draft.injury.painWhen === p.value} onClick={() => update({ injury: { ...draft.injury, painWhen: p.value } })}>
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Anything else about it? (optional)">
                  <Textarea value={draft.injury.notes} onChange={(e) => update({ injury: { ...draft.injury, notes: e.target.value } })} maxLength={500} />
                </Field>
              </>
            )}
            {draft.hasInjury !== undefined && (
              <Field label="Past injuries we should know about? (optional)">
                <Textarea value={draft.injuryHistory} onChange={(e) => update({ injuryHistory: e.target.value })} placeholder="e.g. Achilles tendinopathy in 2025" maxLength={500} />
              </Field>
            )}
            {caution && <Note tone="caution">{caution}</Note>}
          </>
        )}

        {step === "week" && (
          <>
            <Heading title="Your week" sub="Tell us roughly when you can train, then fine-tune any day." />
            <WeekPlanner
              quick={draft.quick}
              onQuickChange={(quick) => update({ quick })}
              value={draft.availability}
              onChange={(availability) => update({ availability })}
              ultra={ultra}
              runs={eff.runs}
              lifts={eff.lifts}
            />
          </>
        )}

        {step === "you" && (
          <>
            <Heading title="Last bits" />
            <Field label="Your name (optional)">
              <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} autoComplete="given-name" maxLength={60} />
            </Field>
            <Field label="Weights in">
              <div className="flex gap-2">
                <Chip selected={draft.weightUnit === "kg"} onClick={() => update({ weightUnit: "kg" })}>kg</Chip>
                <Chip selected={draft.weightUnit === "lb"} onClick={() => update({ weightUnit: "lb" })}>lb</Chip>
              </div>
            </Field>
            <Field label="Distances in">
              <div className="flex gap-2">
                <Chip selected={draft.distanceUnit === "km"} onClick={() => update({ distanceUnit: "km" })}>km</Chip>
                <Chip selected={draft.distanceUnit === "mi"} onClick={() => update({ distanceUnit: "mi" })}>miles</Chip>
              </div>
            </Field>
          </>
        )}

        {step === "review" && <Review draft={draft} caution={caution} />}

        {errors.length > 0 && (
          <Note tone="caution">
            {errors.map((e) => (
              <span key={e} className="block">{e}</span>
            ))}
          </Note>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-background/90 px-4 pt-3 pb-4 backdrop-blur pb-safe">
        {problem && step !== "welcome" && <p className="mb-2 text-center text-sm text-muted-foreground">{problem}</p>}
        {step === "review" ? (
          <Button size="lg" className="h-14 w-full rounded-2xl text-base font-semibold" onClick={build} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Building your plan…
              </>
            ) : (
              "Build my plan"
            )}
          </Button>
        ) : (
          <Button size="lg" className="h-14 w-full rounded-2xl text-base font-semibold" onClick={next} disabled={problem !== null}>
            {step === "welcome" ? "Get started" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h1 className="font-display text-4xl leading-none uppercase">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Review({ draft, caution }: { draft: Draft; caution: string | null }) {
  const distance = DISTANCES.find((x) => x.value === draft.raceDistance)?.label;
  const goal =
    draft.goalType === "race"
      ? [draft.raceDistance === "ultra" ? `${draft.ultraDistanceKm} km ultra (${draft.terrain})` : distance, draft.targetDate && formatDate(draft.targetDate)].filter(Boolean).join(", ")
      : draft.goalType === "strength"
        ? "Getting stronger"
        : "General fitness";
  const week = draft.availability
    .map((d, i) => (d.minutes === null ? null : `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]} ${formatDayMinutes(d.minutes, draft.raceDistance === "ultra")}${d.isDouble ? " ×2" : ""}`))
    .filter(Boolean)
    .join(" · ");
  const eff = effective(draft);
  const time = draft.justFinish ? "Just finish" : targetSeconds(draft) ? formatDuration(targetSeconds(draft)!) : "";
  const rows: [string, string][] = [
    ["Goal", [goal, draft.goalType === "race" ? time : draft.goalDetail].filter(Boolean).join(" · ")],
    ["Each week", `${plural(eff.runs, "run")} · ${plural(eff.lifts, "gym session")}`],
    ["Experience", `${{ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[draft.experienceLevel ?? "intermediate"]} · ${LAST_WEEK_RUN_OPTIONS.find((o) => o.minutes === draft.lastWeekRunMinutes)?.label ?? ""} running last week`],
    ["Lifting", `${{ low: "Low", moderate: "Moderate", high: "Higher" }[eff.volume]} · ${draft.equipment.join(", ")}`],
    ["Injury", draft.hasInjury ? `${draft.injury.area}, ${draft.injury.painLevel}/10` : "None"],
    ["Your week", week],
  ];
  return (
    <>
      <Heading title="Ready to build" sub="Check your answers, then ede. builds your whole plan." />
      <dl className="divide-y rounded-2xl border bg-card">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 p-4 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {caution && <Note tone="caution">{caution}</Note>}
      <MedicalNotice />
    </>
  );
}

/** A row of number buttons: one tap to choose, all options visible. */
function NumberRow({
  min,
  max,
  value,
  recommended,
  onChange,
  label,
}: {
  min: number;
  max: number;
  value: number;
  recommended: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${n} ${label}${n === recommended ? ", recommended" : ""}`}
          onClick={() => onChange(n)}
          className={`relative h-12 flex-1 rounded-xl border font-display text-xl transition-colors active:scale-[0.95] ${
            value === n ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
          }`}
        >
          {n}
          {n === recommended && value !== n && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
