"use client";

// The setup screens, one component each. Onboarding strings them together;
// the You section opens one at a time to edit a section of the plan.
import { MedicalNotice } from "@/components/medical-notice";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BODY_AREAS, type BodyArea } from "@/lib/domain";
import { formatDate, formatDayMinutes, formatDuration, plural } from "@/lib/format";
import {
  cautionFor,
  desiredTimeNote,
  EQUIPMENT_OPTIONS,
  LAST_WEEK_RUN_OPTIONS,
  LONGEST_RUN_OPTIONS,
  planStartDate,
  strengthVolumeNote,
  ULTRA_PRESETS,
} from "@/lib/onboarding";
import { desiredVsPredicted } from "@/lib/paces";
import { HealthConsentCheck } from "@/components/health-consent";
import { Chip, Field, Note, OptionCard } from "./choices";
import { DISTANCES, effective, fiveKSeconds, PAIN_WHEN, shortRace, targetSeconds, today, type Draft } from "./draft";
import { WeekPlanner } from "./week-planner";

export type StepProps = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  /** Editing a saved plan from the You section rather than setting one up. */
  editing?: boolean;
};

export function StepGoal({ draft, update }: StepProps) {
  const ultra = draft.goalType === "race" && draft.raceDistance === "ultra";
  const timeNote = draft.justFinish ? null : desiredTimeNote(draft.raceDistance, targetSeconds(draft), draft.experienceLevel);
  return (
    <>
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
    </>
  );
}

export function StepExperience({ draft, update, editing = false }: StepProps) {
  const eff = effective(draft);
  const predictedNote = draft.justFinish || draft.goalType !== "race" ? null : desiredVsPredicted(draft.raceDistance, targetSeconds(draft), fiveKSeconds(draft));
  return (
    <>
          <>
        <Heading title={editing ? "Training" : "Where are you starting from?"} />
        <div className="flex flex-col gap-2">
          <OptionCard selected={draft.experienceLevel === "beginner"} onClick={() => update({ experienceLevel: "beginner" })} title="Beginner" description="New to running, lifting, or both. We'll start gently with run/walk and simple lifts." />
          <OptionCard selected={draft.experienceLevel === "intermediate"} onClick={() => update({ experienceLevel: "intermediate" })} title="Intermediate" description="You run and lift fairly regularly and know the main lifts." />
          <OptionCard selected={draft.experienceLevel === "advanced"} onClick={() => update({ experienceLevel: "advanced" })} title="Advanced" description="Years of consistent training, and you've raced before." />
        </div>
        {/* When editing, the plan carries on from your actual weeks instead. */}
        {!editing && (
          <>
        <Field label="Roughly how much did you run last week?">
          <div className="flex flex-wrap gap-2">
            {LAST_WEEK_RUN_OPTIONS.map((o) => (
              <Chip key={o.label} selected={draft.lastWeekRunMinutes === o.minutes} onClick={() => update({ lastWeekRunMinutes: o.minutes })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Your longest run in the last month">
          <div className="flex flex-wrap gap-2">
            {LONGEST_RUN_OPTIONS.map((o) => (
              <Chip key={o.label} selected={draft.longestRecentRunMinutes === o.minutes} onClick={() => update({ longestRecentRunMinutes: o.minutes })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>
          </>
        )}
        <Field label="A recent 5K time (optional)" hint="Adds pace guides to your sessions. A race or a hard solo 5K in the last couple of months is best.">
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" min={10} max={60} className="w-20 text-center" value={draft.fiveKMin} onChange={(e) => update({ fiveKMin: e.target.value })} aria-label="5K minutes" placeholder="mm" />
            <span className="font-display text-2xl">:</span>
            <Input type="number" inputMode="numeric" min={0} max={59} className="w-20 text-center" value={draft.fiveKSec} onChange={(e) => update({ fiveKSec: e.target.value })} aria-label="5K seconds" placeholder="ss" />
            <span className="text-sm text-muted-foreground">min : sec</span>
          </div>
          {predictedNote && <Note>{predictedNote}</Note>}
        </Field>
        <Field label="Runs a week in your plan" hint={`Recommended for your goal: ${eff.rec.runs}`}>
          <NumberRow min={1} max={6} value={eff.runs} recommended={eff.rec.runs} onChange={(n) => update({ runsPerWeek: n })} label="runs" />
        </Field>
        <Field label="Gym sessions a week" hint={`Recommended for your goal: ${eff.rec.lifts}`}>
          <NumberRow min={1} max={5} value={eff.lifts} recommended={eff.rec.lifts} onChange={(n) => update({ liftsPerWeek: n })} label="gym sessions" />
        </Field>
          </>
    </>
  );
}

export function StepStrength({ draft, update, editing = false }: StepProps) {
  const eff = effective(draft);
  const volumeNote = strengthVolumeNote({ strengthVolume: eff.volume, raceDistance: draft.raceDistance, experienceLevel: draft.experienceLevel, runsPerWeek: eff.runs });
  return (
    <>
          <>
        <Heading title="How much lifting?" sub={editing ? undefined : "You can change this later in your profile."} />
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
    </>
  );
}

export function StepInjury({ draft, update }: StepProps) {
  const caution = cautionFor({ injury: draft.hasInjury ? draft.injury : undefined, injuryHistory: draft.injuryHistory });
  return (
    <>
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
            <InjuryFields injury={draft.injury} onChange={(injury) => update({ injury })} />
          </>
        )}
        {draft.hasInjury !== undefined && (
          <Field label="Past injuries we should know about? (optional)">
            <Textarea value={draft.injuryHistory} onChange={(e) => update({ injuryHistory: e.target.value })} placeholder="e.g. Achilles tendinopathy in 2025" maxLength={500} />
          </Field>
        )}
        {(draft.hasInjury || draft.injuryHistory.trim()) && (
          <HealthConsentCheck checked={!!draft.healthConsent} onChange={(healthConsent) => update({ healthConsent })} />
        )}
        {caution && <Note tone="caution">{caution}</Note>}
          </>
    </>
  );
}

export function StepWeek({ draft, update }: StepProps) {
  const eff = effective(draft);
  const ultra = draft.goalType === "race" && draft.raceDistance === "ultra";
  return (
    <>
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
    </>
  );
}

export function StepYou({ draft, update }: StepProps) {
  return (
    <>
          <>
        <Heading title="Last bits" />
        <Field label="What should we call you?">
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
    </>
  );
}

export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h1 className="text-[2.6rem] leading-[1.05] font-medium tracking-tighter">{title}</h1>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Review({ draft, caution }: { draft: Draft; caution: string | null }) {
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
    ["Longest recent run", LONGEST_RUN_OPTIONS.find((o) => o.minutes === draft.longestRecentRunMinutes)?.label ?? ""],
    ...(fiveKSeconds(draft) ? ([["Recent 5K", formatDuration(fiveKSeconds(draft)!)]] as [string, string][]) : []),
    ["Experience", `${{ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[draft.experienceLevel ?? "intermediate"]} · ${LAST_WEEK_RUN_OPTIONS.find((o) => o.minutes === draft.lastWeekRunMinutes)?.label ?? ""} running last week`],
    ["Lifting", `${{ low: "Low", moderate: "Moderate", high: "Higher" }[eff.volume]} · ${draft.equipment.join(", ")}`],
    ["Injury", draft.hasInjury ? `${draft.injury.area}, ${draft.injury.painLevel}/10` : "None"],
    ["Your week", week],
  ];
  return (
    <>
      <Heading title={draft.name.trim() ? `Ready, ${draft.name.trim()}` : "Ready to build"} sub="Check your answers, then ede. builds your whole plan." />
      <dl className="divide-y rounded-2xl border bg-card px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3 text-sm">
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
export function NumberRow({
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
            value === n ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent"
          }`}
        >
          {n}
          {n === recommended && value !== n && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary-strong" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Where it hurts, how much and when: used in setup and when reporting an injury. */
export function InjuryFields({ injury, onChange }: { injury: Draft["injury"]; onChange: (injury: Draft["injury"]) => void }) {
  return (
    <>
      <Field label="Where?">
        <div className="flex flex-wrap gap-2">
          {BODY_AREAS.map((a) => (
            <Chip key={a} selected={injury.area === a} onClick={() => onChange({ ...injury, area: a as BodyArea })}>
              {a[0].toUpperCase() + a.slice(1)}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={`How bad? ${injury.painLevel} out of 10`}>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={injury.painLevel}
          onChange={(e) => onChange({ ...injury, painLevel: Number(e.target.value) })}
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
            <Chip key={p.value} selected={injury.painWhen === p.value} onClick={() => onChange({ ...injury, painWhen: p.value })}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Anything else about it? (optional)">
        <Textarea value={injury.notes} onChange={(e) => onChange({ ...injury, notes: e.target.value })} maxLength={500} />
      </Field>
    </>
  );
}
