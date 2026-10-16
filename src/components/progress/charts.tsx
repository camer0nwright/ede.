"use client";

// Progress charts (SPEC decision 55). The server works out the values and
// labels; these draw them and show the details of a tapped bar or point.
import { useState } from "react";
import { cn } from "@/lib/utils";

export type Tick = { value: number; label: string };

export type Bar = {
  key: string;
  /** Under the bar: the week number. */
  axisLabel: string;
  value: number;
  /** Drawn behind the bar, such as the running the plan asked for. */
  ghost?: number;
  /** What the readout says when this bar is picked. */
  readout: string;
};

const MARK = { run: "bg-chart-run", strength: "bg-chart-strength" } as const;

/** A tall-enough box with gridlines and labels on the left, shared by both charts. */
function Plot({ ticks, bottom, top, children }: { ticks: Tick[]; bottom: number; top: number; children: React.ReactNode }) {
  const y = (v: number) => `${((v - bottom) / (top - bottom)) * 100}%`;
  return (
    <div className="relative mt-3 h-36 pl-9">
      {ticks.map((t) => (
        <div key={t.value} className="pointer-events-none absolute inset-x-0" style={{ bottom: y(t.value) }} aria-hidden>
          <div className={cn("ml-9 border-t", t.value === bottom ? "border-foreground/25" : "border-dashed border-border")} />
          <span className="absolute left-0 w-7 -translate-y-1/2 text-right text-[10px] text-muted-foreground tabular-nums">{t.label}</span>
        </div>
      ))}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** One line above the chart that says what's picked; the latest by default. */
function Readout({ text }: { text: string }) {
  return (
    <p className="min-h-5 text-sm text-muted-foreground tabular-nums" aria-live="polite">
      {text}
    </p>
  );
}

/**
 * Weekly bars, oldest on the left. Tapping or hovering a bar shows its week
 * in the readout. Bars rise from the baseline with rounded tops.
 */
export function WeekBars({
  bars,
  ticks,
  colour,
  legend,
  caption,
}: {
  bars: Bar[];
  ticks: Tick[];
  colour: keyof typeof MARK;
  legend?: { value: string; ghost: string };
  caption: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const top = ticks.at(-1)?.value ?? 1;
  const current = bars.find((b) => b.key === picked) ?? bars.at(-1);
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;

  return (
    <figure>
      {legend && (
        <div className="mb-1 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px]", MARK[colour])} aria-hidden /> {legend.value}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-foreground/12" aria-hidden /> {legend.ghost}
          </span>
        </div>
      )}
      <Readout text={current?.readout ?? ""} />
      <Plot ticks={ticks} bottom={0} top={top}>
        <div className="flex h-full items-end" onMouseLeave={() => setPicked(null)}>
          {bars.map((b) => {
            const on = current?.key === b.key;
            return (
              <button
                key={b.key}
                type="button"
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseEnter={() => setPicked(b.key)}
                onFocus={() => setPicked(b.key)}
                onClick={() => setPicked(b.key)}
                aria-label={`${caption} ${b.axisLabel}: ${b.readout}`}
                aria-pressed={on}
              >
                {on && picked && <span className="absolute inset-x-0.5 inset-y-0 rounded-md bg-foreground/5" aria-hidden />}
                {b.ghost !== undefined && b.ghost > 0 && (
                  <span className="absolute bottom-0 w-[58%] max-w-5 rounded-t-[4px] bg-foreground/12" style={{ height: pct(b.ghost) }} aria-hidden />
                )}
                <span
                  className={cn("relative w-[58%] max-w-5 rounded-t-[4px] transition-opacity", MARK[colour], picked && !on && "opacity-55")}
                  style={{ height: b.value > 0 ? `max(2px, ${pct(b.value)})` : 0 }}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </Plot>
      <div className="mt-1 flex pl-9 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 text-center">
            {bars.length <= 8 || i % 2 === (bars.length - 1) % 2 ? b.axisLabel : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-0.5 pl-9 text-center text-[10px] text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export type LinePoint = { key: string; /** 0 to 1 across the chart. */ x: number; value: number; readout: string };

export type LineSeries = {
  exercise: string;
  /** The latest value, large: "78 kg est. max" or "12 reps". */
  headline: string;
  /** "+5 kg since 6 Oct", when there's more than one workout. */
  change?: string;
  points: LinePoint[];
  ticks: Tick[];
  bottom: number;
  top: number;
  /** The first and last dates, under the chart. */
  from: string;
  to: string;
};

/** How each lift has moved: pick an exercise, then tap a point for that workout. */
export function LiftLines({ series }: { series: LineSeries[] }) {
  const [exercise, setExercise] = useState(series[0]?.exercise);
  const [picked, setPicked] = useState<string | null>(null);
  const s = series.find((x) => x.exercise === exercise) ?? series[0];
  if (!s) return null;
  const current = s.points.find((p) => p.key === picked) ?? s.points.at(-1);
  const y = (v: number) => ((v - s.bottom) / (s.top - s.bottom)) * 100;
  const line = s.points.map((p) => `${p.x * 100},${100 - y(p.value)}`).join(" ");

  return (
    <div>
      {series.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Exercise">
          {series.map((x) => (
            <button
              key={x.exercise}
              type="button"
              onClick={() => {
                setExercise(x.exercise);
                setPicked(null);
              }}
              aria-pressed={x.exercise === s.exercise}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
                x.exercise === s.exercise ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.exercise}
            </button>
          ))}
        </div>
      )}
      <figure>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl tabular-nums">{s.headline}</p>
          {s.change && <p className="text-xs text-muted-foreground tabular-nums">{s.change}</p>}
        </div>
        <Readout text={current?.readout ?? ""} />
        <Plot ticks={s.ticks} bottom={s.bottom} top={s.top}>
          <div className="absolute inset-x-2.5 inset-y-0" onMouseLeave={() => setPicked(null)}>
            {s.points.length > 1 && (
              <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polyline points={line} fill="none" className="stroke-chart-strength" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
            {current && (
              <span className="pointer-events-none absolute inset-y-0 border-l border-foreground/20" style={{ left: `${current.x * 100}%` }} aria-hidden />
            )}
            {s.points.map((p) => {
              const on = current?.key === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className="absolute grid size-8 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ left: `${p.x * 100}%`, bottom: `${y(p.value)}%` }}
                  onMouseEnter={() => setPicked(p.key)}
                  onFocus={() => setPicked(p.key)}
                  onClick={() => setPicked(p.key)}
                  aria-label={p.readout}
                  aria-pressed={on}
                >
                  <span className={cn("rounded-full bg-chart-strength ring-2 ring-card transition-[width,height]", on ? "size-3" : "size-2")} aria-hidden />
                </button>
              );
            })}
          </div>
        </Plot>
        <div className="mt-1 flex justify-between pl-9 text-[10px] text-muted-foreground" aria-hidden>
          <span>{s.from}</span>
          {s.to !== s.from && <span>{s.to}</span>}
        </div>
      </figure>
    </div>
  );
}
