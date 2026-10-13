"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { DAY_NAMES, summariseAvailability, type Availability, type AvailabilityDay } from "@/lib/domain";
import { formatDayMinutes, formatMinutesShort, plural } from "@/lib/format";
import { DAY_MINUTES, quickWeekToAvailability, ULTRA_DAY_MINUTES, weekFitProblem, type QuickWeek } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { Chip, Field, Note } from "./choices";

const WEEKDAY_OPTIONS = [30, 45, 60, 90] as const;
const WEEKEND_OPTIONS = [60, 90, 120] as const;
const ULTRA_WEEKEND_OPTIONS = [120, 180, 240, 300, 360] as const;
const SECOND_SESSION_OPTIONS = [30, 45, 60, 90] as const;

/**
 * The availability step (SPEC decision 31): three quick questions fill in the
 * week, then any day can be fine-tuned in a bottom sheet. Shows whether the
 * chosen runs and gym sessions fit.
 */
export function WeekPlanner({
  quick,
  onQuickChange,
  value,
  onChange,
  ultra,
  runs,
  lifts,
}: {
  quick: QuickWeek;
  onQuickChange: (quick: QuickWeek) => void;
  value: Availability;
  onChange: (value: Availability) => void;
  ultra: boolean;
  runs: number;
  lifts: number;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const applyQuick = (q: QuickWeek) => {
    onQuickChange(q);
    onChange(quickWeekToAvailability(q, value));
  };
  const toggleDay = (i: number) =>
    applyQuick({ ...quick, days: quick.days.includes(i) ? quick.days.filter((d) => d !== i) : [...quick.days, i].sort() });
  // Editing a day in the sheet keeps the quick "which days" answer in step.
  const setDay = (i: number, day: Partial<AvailabilityDay>) => {
    const next = value.map((d, j) => (j === i ? { ...d, ...day } : d));
    onChange(next);
    onQuickChange({ ...quick, days: next.flatMap((d, j) => (d.minutes === null ? [] : [j])) });
  };

  const summary = summariseAvailability(value);
  const fit = weekFitProblem(value, runs, lifts);
  const weekendOptions = ultra ? ULTRA_WEEKEND_OPTIONS : WEEKEND_OPTIONS;
  const dayOptions = ultra ? ULTRA_DAY_MINUTES : DAY_MINUTES;

  return (
    <div className="flex flex-col gap-6">
      <Field label="Which days can you train?">
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Training days">
          {DAY_NAMES.map((name, i) => {
            const on = quick.days.includes(i);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                aria-label={name}
                onClick={() => toggleDay(i)}
                className={cn(
                  "h-12 rounded-full border text-sm font-semibold transition-colors active:scale-[0.95]",
                  on ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent",
                )}
              >
                {name[0]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Time on weekdays">
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((m) => (
            <Chip key={m} selected={quick.weekdayMinutes === m} onClick={() => applyQuick({ ...quick, weekdayMinutes: m })}>
              {formatMinutesShort(m)}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Time at weekends">
        <div className="flex flex-wrap gap-2">
          {weekendOptions.map((m) => (
            <Chip key={m} selected={quick.weekendMinutes === m} onClick={() => applyQuick({ ...quick, weekendMinutes: m })}>
              {formatDayMinutes(m, ultra)}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Fine-tune any day" hint="Tap a day to change its time or make it a double day (a run and a lift).">
        <div className="grid grid-cols-7 gap-1.5">
          {value.map((d, i) => (
            <button
              key={DAY_NAMES[i]}
              type="button"
              onClick={() => setEditing(i)}
              aria-label={`${DAY_NAMES[i]}: ${d.minutes === null ? "rest" : formatDayMinutes(d.minutes, ultra)}${d.isDouble ? ", double day" : ""}. Edit`}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center rounded-xl text-center transition-colors active:scale-[0.95]",
                d.minutes === null ? "bg-secondary/60 text-muted-foreground" : "border bg-card hover:bg-accent",
              )}
            >
              <span className="text-[11px] text-muted-foreground">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className="font-display text-base leading-tight">{d.minutes === null ? "Rest" : formatDayMinutes(d.minutes, ultra)}</span>
              {d.isDouble && <span className="text-[10px] font-semibold text-primary-strong">×2</span>}
            </button>
          ))}
        </div>
      </Field>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")},{" "}
        {plural(summary.restDays, "full rest day")}.
      </p>
      {fit ? (
        <Note tone="caution">{fit}</Note>
      ) : (
        <p className="rounded-xl border border-easy/40 bg-easy/10 p-3 text-sm">
          Fits your {plural(runs, "run")} and {plural(lifts, "gym session")} a week.
        </p>
      )}

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent>
          {editing !== null && (
            <div className="mx-auto w-full max-w-md px-4 pb-8">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="text-2xl font-semibold">{DAY_NAMES[editing]}</DrawerTitle>
                <DrawerDescription>How much time do you have?</DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-wrap gap-2">
                <Chip selected={value[editing].minutes === null} onClick={() => setDay(editing, { minutes: null, isDouble: false, secondMinutes: null })}>
                  Rest
                </Chip>
                {dayOptions.map((m) => (
                  <Chip key={m} selected={value[editing].minutes === m} onClick={() => setDay(editing, { minutes: m })}>
                    {formatDayMinutes(m, ultra)}
                  </Chip>
                ))}
              </div>
              {value[editing].minutes !== null && (
                <div className="mt-5 flex flex-col gap-3">
                  <label className="flex items-center justify-between gap-3 text-sm font-medium">
                    Double day (a run and a lift)
                    <Switch
                      checked={value[editing].isDouble}
                      onCheckedChange={(on) => setDay(editing, { isDouble: on, secondMinutes: on ? 45 : null })}
                    />
                  </label>
                  {value[editing].isDouble && (
                    <div>
                      <p className="mb-2 text-sm text-muted-foreground">Time for the second session</p>
                      <div className="flex flex-wrap gap-2">
                        {SECOND_SESSION_OPTIONS.map((m) => (
                          <Chip key={m} selected={value[editing].secondMinutes === m} onClick={() => setDay(editing, { secondMinutes: m })}>
                            {formatMinutesShort(m)}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="mt-6 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
              >
                Done
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
