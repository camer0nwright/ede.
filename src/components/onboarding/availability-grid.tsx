"use client";

import { Switch } from "@/components/ui/switch";
import { DAY_NAMES, summariseAvailability, type Availability, type AvailabilityDay } from "@/lib/domain";
import { formatDayMinutes, formatMinutesShort, plural } from "@/lib/format";
import { DAY_MINUTES, ULTRA_DAY_MINUTES } from "@/lib/onboarding";
import { Chip } from "./choices";

export function AvailabilityGrid({
  value,
  onChange,
  ultra,
}: {
  value: Availability;
  onChange: (value: Availability) => void;
  ultra: boolean;
}) {
  const options = ultra ? ULTRA_DAY_MINUTES : DAY_MINUTES;
  const set = (i: number, day: Partial<AvailabilityDay>) =>
    onChange(value.map((d, j) => (j === i ? { ...d, ...day } : d)));
  const summary = summariseAvailability(value);

  return (
    <div className="flex flex-col gap-3">
      {value.map((d, i) => {
        const rest = d.minutes === null;
        return (
          <div key={DAY_NAMES[i]} className="rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg uppercase">{DAY_NAMES[i]}</span>
              {!rest && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Double day
                  <Switch
                    checked={d.isDouble}
                    onCheckedChange={(on) => set(i, { isDouble: on, secondMinutes: on ? 45 : null })}
                    aria-label={`${DAY_NAMES[i]}: double day (a run and a lift)`}
                  />
                </label>
              )}
            </div>
            <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 no-scrollbar" role="group" aria-label={`${DAY_NAMES[i]} time`}>
              <Chip selected={rest} onClick={() => set(i, { minutes: null, isDouble: false, secondMinutes: null })} className="px-3.5">
                Rest
              </Chip>
              {options.map((m) => (
                <Chip key={m} selected={d.minutes === m} onClick={() => set(i, { minutes: m })} className="px-3.5">
                  {formatDayMinutes(m, ultra)}
                </Chip>
              ))}
            </div>
            {d.isDouble && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Second session (a lift if the first is a run, or the other way round)</p>
                <div className="-mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3 pb-1 no-scrollbar" role="group" aria-label={`${DAY_NAMES[i]} second session time`}>
                  {DAY_MINUTES.slice(0, 4).map((m) => (
                    <Chip key={m} selected={d.secondMinutes === m} onClick={() => set(i, { secondMinutes: m })} className="px-3.5">
                      {formatMinutesShort(m)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")},{" "}
        {plural(summary.restDays, "full rest day")}. Double days put a run and a lift on one day, to free up more full rest days.
      </p>
    </div>
  );
}
