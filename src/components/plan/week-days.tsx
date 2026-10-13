"use client";

import { useState } from "react";
import { Dumbbell, Footprints } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatMinutes, INTENSITY_COLOR, INTENSITY_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayView, Effort, LiftView, RunView, SessionView } from "@/lib/week-view";

const EFFORT_BG: Record<Effort, string> = { easy: "bg-easy", moderate: "bg-moderate", hard: "bg-hard" };
const EFFORT_TEXT: Record<Effort, string> = { easy: "text-easy", moderate: "text-moderate", hard: "text-hard" };

/** A run's shape at a glance: one segment per step, coloured by effort, sized by time. */
export function EffortBar({ steps, className }: { steps: RunView["steps"]; className?: string }) {
  return (
    <div className={cn("flex h-1.5 gap-0.5 overflow-hidden rounded-full", className)} aria-hidden>
      {steps.map((s, i) => (
        <span key={i} className={EFFORT_BG[s.effort]} style={{ flexGrow: s.minutes }} />
      ))}
    </div>
  );
}

/** Mon-Sun at a glance: blue for a run, orange for a lift, both for a double day, grey for rest. */
export function WeekStrip({ days, today }: { days: DayView[]; today?: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="This week by day">
      {days.map((d) => {
        const run = d.sessions.some((s) => s.type === "run");
        const lift = d.sessions.some((s) => s.type === "strength");
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className={cn("text-[11px] text-muted-foreground", d.date === today && "font-semibold text-primary-strong")}>{d.dayName[0]}</span>
            <span className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-secondary">
              {run && <span className="flex-1 bg-run" />}
              {lift && <span className="flex-1 bg-strength" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function WeekDays({ days, today, onlyToday = false }: { days: DayView[]; today?: string; onlyToday?: boolean }) {
  const [open, setOpen] = useState<{ session: SessionView; day: DayView } | null>(null);
  const shown = onlyToday ? days.filter((d) => d.date === today) : days;

  return (
    <>
      <ol className="flex flex-col gap-2">
        {shown.map((d) => (
          <li key={d.date}>
            {d.sessions.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                <span className={cn("font-medium", d.date === today && "text-primary-strong")}>{d.dayName}</span> · Rest day
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="px-1 pt-1 text-xs text-muted-foreground">
                  <span className={cn("font-medium", d.date === today ? "text-primary-strong" : "text-foreground")}>{d.date === today ? "Today" : d.dayName}</span>
                  {d.note && <> · {d.note}</>}
                </p>
                {d.sessions.map((s) => (
                  <SessionCard key={s.id} session={s} onOpen={() => setOpen({ session: s, day: d })} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent className="max-h-[90dvh]">
          {open && (
            <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
              {open.session.type === "run" ? <RunSheet run={open.session} /> : <LiftSheet lift={open.session} day={open.day} />}
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="h-12 rounded-2xl border font-medium hover:bg-accent"
                  onClick={() => toast("Skipping sessions arrives with check-ins, coming next.")}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="h-12 rounded-2xl bg-primary font-semibold text-primary-foreground"
                  onClick={() => toast("Marking sessions done arrives with check-ins, coming next.")}
                >
                  Mark done
                </button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function SessionCard({ session: s, onOpen }: { session: SessionView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent active:scale-[0.99]"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        {s.type === "run" ? <Footprints className="size-4.5 text-run" aria-hidden /> : <Dumbbell className="size-4.5 text-strength" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{s.title}</span>
          <span className="shrink-0 font-display text-lg">{formatMinutes(s.minutes)}</span>
        </span>
        {s.type === "run" ? (
          <>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              <span className={cn("font-semibold", INTENSITY_COLOR[s.intensity])}>{INTENSITY_LABEL[s.intensity]}</span> · {s.purpose}
            </span>
            <EffortBar steps={s.steps} className="mt-2" />
          </>
        ) : (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {s.exercises.length} exercises · {s.exercises.slice(0, 2).map((e) => e.name).join(", ")}
            {s.exercises.length > 2 && "…"}
          </span>
        )}
      </span>
    </button>
  );
}

function RunSheet({ run }: { run: RunView }) {
  return (
    <>
      <DrawerHeader className="px-0 text-left">
        <p className="text-xs text-muted-foreground">
          {run.roleLabel}
          {run.level && ` · Level ${run.level} of ${run.maxLevel}`}
        </p>
        <DrawerTitle className="font-display text-3xl uppercase">
          {run.title} · {formatMinutes(run.minutes)}
        </DrawerTitle>
        <DrawerDescription className="sr-only">Session details</DrawerDescription>
      </DrawerHeader>
      <p className="rounded-xl border border-easy/30 bg-easy/10 p-3 text-sm">
        <span className="font-semibold">Why: </span>
        {run.purpose}
      </p>
      <EffortBar steps={run.steps} className="mt-4 h-2.5" />
      <ol className="mt-3 flex flex-col gap-2">
        {run.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <span className={cn("size-2 shrink-0 rounded-full", EFFORT_BG[step.effort])} aria-hidden />
            <span className="flex-1 text-sm">{step.name}</span>
            <span className="text-right text-xs">
              <span className="block font-medium">{formatMinutes(step.minutes)}</span>
              <span className={cn("font-semibold", EFFORT_TEXT[step.effort])}>RPE {step.targetRpe}</span>
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
      <DrawerHeader className="px-0 text-left">
        <p className="text-xs text-muted-foreground">
          {day.dayName} · {lift.exercises.length} exercises
        </p>
        <DrawerTitle className="font-display text-3xl uppercase">
          {lift.title} · {formatMinutes(lift.minutes)}
        </DrawerTitle>
        <DrawerDescription className="sr-only">Session details</DrawerDescription>
      </DrawerHeader>
      <p className="rounded-xl border border-strength/30 bg-strength/10 p-3 text-sm">
        <span className="font-semibold">Why: </span>
        {lift.purpose}
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {lift.exercises.map((e) => (
          <li key={e.name} className="rounded-xl bg-secondary p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{e.name}</span>
              {e.isMainLift && <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary-strong">Main lift</span>}
            </div>
            <p className="mt-1 text-sm">
              {e.warmupSets > 0 && <span className="text-muted-foreground">{e.warmupSets} warm-up + </span>}
              <span className="font-display text-lg">
                {e.workingSets} × {e.reps}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              RPE {e.targetRpe}
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
