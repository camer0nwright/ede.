"use client";

import { useState } from "react";
import { Check, Dumbbell, Footprints } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatMinutes, INTENSITY_COLOR, INTENSITY_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayView, Effort, LiftView, RunView, SessionView } from "@/lib/week-view";
import { CheckInPanel, checkInSummary, WorkoutButton, type CheckInOptions } from "./check-in-sheet";

const EFFORT_BG: Record<Effort, string> = { easy: "bg-easy", moderate: "bg-moderate", hard: "bg-hard" };
const EFFORT_TEXT: Record<Effort, string> = { easy: "text-easy", moderate: "text-moderate", hard: "text-hard" };

const short = (dayName: string) => dayName.slice(0, 3);
const dateNumber = (date: string) => Number(date.slice(8, 10));

/** A run's shape at a glance: one segment per step, coloured by effort, sized by time. */
export function EffortBar({ steps, className }: { steps: RunView["steps"]; className?: string }) {
  return (
    <div className={cn("flex h-1 gap-0.5 overflow-hidden rounded-full", className)} aria-hidden>
      {steps.map((s, i) => (
        <span key={i} className={EFFORT_BG[s.effort]} style={{ flexGrow: s.minutes }} />
      ))}
    </div>
  );
}

/** Run or lift, as a small icon in its colour. */
function SessionIcon({ type, className }: { type: SessionView["type"]; className?: string }) {
  return type === "run" ? (
    <Footprints className={cn("size-4 text-run", className)} aria-label="Run" />
  ) : (
    <Dumbbell className={cn("size-4 text-strength", className)} aria-label="Lift" />
  );
}

/** Mon-Sun with dates: today circled, a dot per session (blue run, orange lift), solid once done, grey if skipped. */
export function WeekStrip({ days, today }: { days: DayView[]; today?: string }) {
  return (
    <ol className="grid grid-cols-7 text-center" aria-label="This week by day">
      {days.map((d) => {
        const isToday = d.date === today;
        const rest = d.sessions.length === 0;
        return (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{d.dayName[0]}</span>
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-sm tabular-nums",
                isToday ? "bg-foreground font-semibold text-background" : rest && "text-muted-foreground",
              )}
            >
              {dateNumber(d.date)}
            </span>
            <span className="flex h-1.5 gap-0.5" aria-label={rest ? "Rest" : d.sessions.map((s) => (s.type === "run" ? "Run" : "Lift")).join(" and ")}>
              {d.sessions.map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "size-1.5 rounded-full",
                    s.checkIn?.status === "skipped" ? "bg-muted-foreground/40" : s.type === "run" ? "bg-run" : "bg-strength",
                    !s.checkIn && "opacity-45",
                  )}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The session sheet: details, then Skip and Mark done, or the check-in once there is one. */
function useSessionSheet(options: CheckInOptions) {
  const [open, setOpen] = useState<{ session: SessionView; day: DayView } | null>(null);
  const sheet = (
    <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
      <DrawerContent className="max-h-[90dvh]">
        {open && (
          <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
            {open.session.type === "run" ? <RunSheet run={open.session} /> : <LiftSheet lift={open.session} day={open.day} />}
            <CheckInPanel key={open.session.id} session={open.session} options={options} onClose={() => setOpen(null)} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
  return { show: (session: SessionView, day: DayView) => setOpen({ session, day }), sheet };
}

/** What a session is, in a few words: effort for runs, exercise count for lifts. */
function detail(s: SessionView, unit: "km" | "mi") {
  if (s.checkIn) return <span className={cn(s.checkIn.status === "completed" && "font-medium text-easy")}>{checkInSummary(s.checkIn, unit)}</span>;
  return s.type === "run" ? (
    <span className={cn("font-medium", INTENSITY_COLOR[s.intensity])}>{INTENSITY_LABEL[s.intensity]}</span>
  ) : (
    `${s.exercises.length} exercises`
  );
}

/** Today's sessions, each as a card with the one main action on the screen. */
export function TodaySessions({ day, options }: { day: DayView; options: CheckInOptions }) {
  const { show, sheet } = useSessionSheet(options);
  return (
    <>
      {day.sessions.map((s) => (
        <article key={s.id} className="flex flex-col border bg-card p-6">
          <p className={cn("label-eyebrow flex items-center gap-1.5", s.type === "run" ? "text-run" : "text-strength")}>
            <SessionIcon type={s.type} className="size-3.5" />
            {s.type === "run" ? `Run · ${INTENSITY_LABEL[s.intensity]}` : "Gym"}
          </p>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[28px] leading-tight font-medium">{s.title}</h2>
            <span className="shrink-0 font-display text-4xl font-semibold tabular-nums">
              {s.minutes}
              <span className="text-sm font-medium"> min</span>
            </span>
          </div>
          <p className="mt-1 flex-1 text-muted-foreground">
            {s.type === "run" ? s.purpose : s.exercises.map((e) => e.name).join(", ")}
          </p>
          {s.type === "run" && <EffortBar steps={s.steps} className="mt-3" />}
          {s.checkIn ? (
            <button type="button" onClick={() => show(s, day)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md border font-medium hover:bg-accent">
              {s.checkIn.status === "completed" && <Check className="size-4 text-easy" aria-hidden />}
              {checkInSummary(s.checkIn, options.unit)}
            </button>
          ) : (
            s.type === "strength" && options.canCheckIn ? (
              <WorkoutButton session={s} className="mt-5 h-12" />
            ) : (
              <button type="button" onClick={() => show(s, day)} className="mt-5 h-12 w-full rounded-md bg-primary font-semibold text-primary-foreground active:scale-[0.99]">
                Start session
              </button>
            )
          )}
        </article>
      ))}
      {sheet}
    </>
  );
}

/** Sessions as a plain list, one row each. With `showRest`, rest days get a quiet row too. */
export function WeekDays({ days, options, showRest = false }: { days: DayView[]; options: CheckInOptions; showRest?: boolean }) {
  const today = options.today;
  const { show, sheet } = useSessionSheet(options);
  return (
    <>
      <ul className="flex flex-col gap-2">
        {days.map((d) => {
          const day = d.date === today ? "Today" : short(d.dayName);
          if (d.sessions.length === 0) {
            return showRest ? (
              <li key={d.date} className="px-4 py-1 text-sm text-muted-foreground">
                {day} · Rest day
              </li>
            ) : null;
          }
          return d.sessions.map((s, i) => (
            <li key={s.id}>
              <button type="button" onClick={() => show(s, d)} className="flex w-full items-center gap-4 border bg-card px-5 py-[18px] text-left transition-colors hover:bg-accent active:scale-[0.99]">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", s.checkIn?.status === "completed" ? "bg-easy/15" : "bg-secondary")}>
                  {s.checkIn?.status === "completed" ? <Check className="size-4 text-easy" aria-label="Done" /> : <SessionIcon type={s.type} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", s.checkIn?.status === "skipped" && "text-muted-foreground line-through")}>{s.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className={cn(d.date === today && "font-medium text-foreground")}>{day}</span> · {detail(s, options.unit)}
                    {i === 0 && d.note && <> · {d.note}</>}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatMinutes(s.minutes)}</span>
              </button>
            </li>
          ));
        })}
      </ul>
      {sheet}
    </>
  );
}

function SheetHeader({ kicker, title, minutes }: { kicker: string; title: string; minutes: number }) {
  return (
    <DrawerHeader className="px-0 text-left! md:text-left">
      <p className="text-xs text-muted-foreground">{kicker}</p>
      <div className="flex items-baseline justify-between gap-3">
        <DrawerTitle className="text-2xl font-semibold">{title}</DrawerTitle>
        <span className="shrink-0 font-display text-2xl tabular-nums">
          {minutes}
          <span className="text-sm"> min</span>
        </span>
      </div>
      <DrawerDescription className="sr-only">Session details</DrawerDescription>
    </DrawerHeader>
  );
}

function RunSheet({ run }: { run: RunView }) {
  return (
    <>
      <SheetHeader kicker={`${run.roleLabel}${run.level ? ` · Level ${run.level} of ${run.maxLevel}` : ""}`} title={run.title} minutes={run.minutes} />
      <p className="text-sm text-muted-foreground">{run.purpose}</p>
      <EffortBar steps={run.steps} className="mt-4 h-1.5" />
      <ol className="mt-2 divide-y">
        {run.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <span className={cn("size-2 shrink-0 rounded-full", EFFORT_BG[step.effort])} aria-hidden />
            <span className="flex-1 text-sm">{step.name}</span>
            <span className="text-right text-xs">
              <span className="block font-medium tabular-nums">{formatMinutes(step.minutes)}</span>
              <span className={cn("font-medium", EFFORT_TEXT[step.effort])}>RPE {step.targetRpe}</span>
              {step.pace && <span className="block text-muted-foreground">{step.pace}</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tip: </span>
        {run.tip}
      </p>
    </>
  );
}

const rest = (seconds: number) => (seconds >= 120 ? `${Math.round(seconds / 60)} min` : `${seconds}s`);

function LiftSheet({ lift, day }: { lift: LiftView; day: DayView }) {
  return (
    <>
      <SheetHeader kicker={`${day.dayName} · ${lift.exercises.length} exercises`} title={lift.title} minutes={lift.minutes} />
      <p className="text-sm text-muted-foreground">{lift.purpose}</p>
      <ol className="mt-2 divide-y">
        {lift.exercises.map((e) => (
          <li key={e.name} className="py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{e.name}</span>
              <span className="shrink-0 font-display text-lg tabular-nums">
                {e.workingSets} × {e.reps}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {e.isMainLift && <span className="font-medium text-foreground">Main lift · </span>}
              {e.warmupSets > 0 && `${e.warmupSets} warm-up sets · `}RPE {e.targetRpe}
              {e.failureAllowed && " · last set to failure is fine"} · rest {rest(e.restSeconds)}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tip: </span>
        {lift.tip}
      </p>
    </>
  );
}
