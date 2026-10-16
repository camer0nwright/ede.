// The progress charts on the history page (SPEC decision 55): values and
// labels worked out here on the server, drawn by the chart components.
import { Dumbbell, Footprints, TrendingUp } from "lucide-react";
import { LiftLines, WeekBars, type Bar, type LineSeries } from "@/components/progress/charts";
import { toUtc } from "@/lib/dates";
import { formatDay, formatMinutes, plural, formatMinutesShort, formatWeekRange } from "@/lib/format";
import type { LiftSet, WeekHistory } from "@/lib/history";
import { formatDistance } from "@/lib/paces";
import { liftChange, liftSeries, liftValue, minuteScale, niceScale, rangeScale, weeklySeries } from "@/lib/progress";
import { formatWeight, type WeightUnit } from "@/lib/workout";

const bigNumber = (n: number) => Math.round(n).toLocaleString("en-GB");
/** 4000 → "4k", 2500 → "2.5k". */
const compact = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n));

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function ProgressCharts({ history, sets, weightUnit, distanceUnit }: { history: WeekHistory[]; sets: LiftSet[]; weightUnit: WeightUnit; distanceUnit: "km" | "mi" }) {
  const weeks = weeklySeries(history);
  const inUnit = (kg: number) => Number(formatWeight(kg, weightUnit));

  const runBars: Bar[] = weeks.map((w) => ({
    key: w.weekStart,
    axisLabel: String(w.weekNumber),
    value: w.runDone,
    ghost: w.runPlanned,
    readout:
      `${formatWeekRange(w.weekStart)} · ${formatMinutes(w.runDone)} of ${formatMinutes(w.runPlanned)}` +
      (w.distanceKm > 0 ? ` · ${formatDistance(w.distanceKm, distanceUnit)}` : ""),
  }));
  const runScale = minuteScale(Math.max(...weeks.map((w) => Math.max(w.runDone, w.runPlanned)), 0));

  const liftBars: Bar[] = weeks.map((w) => ({
    key: w.weekStart,
    axisLabel: String(w.weekNumber),
    value: inUnit(w.liftedKg),
    readout: `${formatWeekRange(w.weekStart)} · ` + (w.liftedKg > 0 ? `${bigNumber(inUnit(w.liftedKg))} ${weightUnit}` : "nothing logged"),
  }));
  const liftScale = niceScale(Math.max(...liftBars.map((b) => b.value), 0));
  const lifted = weeks.some((w) => w.liftedKg > 0);

  const lines: LineSeries[] = liftSeries(sets)
    .filter((s) => s.points.length > 0)
    .map((s): LineSeries => {
      // Estimated maxes are rough, so whole numbers.
      const value = (v: number) => (s.weighted ? Math.round(inUnit(v)) : v);
      const shown = (v: number) => (s.weighted ? `${value(v)} ${weightUnit}` : plural(v, "rep"));
      const values = s.points.map((p) => value(liftValue(p)));
      const scale = rangeScale(Math.min(...values), Math.max(...values));
      const [first, last] = [toUtc(s.points[0].date), toUtc(s.points.at(-1)!.date)];
      const change = liftChange(s);
      const changeText =
        change === null
          ? undefined
          : value(Math.abs(change)) === 0
            ? `Same as ${formatDay(s.points[0].date)}`
            : `${change > 0 ? "+" : "−"}${shown(Math.abs(change))} since ${formatDay(s.points[0].date)}`;
      return {
        exercise: s.exercise,
        headline: shown(liftValue(s.points.at(-1)!)) + (s.weighted ? " est. max" : ""),
        ...(changeText && { change: changeText }),
        points: s.points.map((p, i) => ({
          key: `${p.sessionId}-${i}`,
          x: last === first ? 0.5 : (toUtc(p.date) - first) / (last - first),
          value: value(liftValue(p)),
          readout: s.weighted
            ? `${formatDay(p.date)}: ${formatWeight(p.best.weightKg!, weightUnit)} ${weightUnit} × ${p.best.reps}, est. max ${shown(p.e1rmKg!)}`
            : `${formatDay(p.date)}: ${p.best.reps} reps`,
        })),
        ticks: scale.values.map((v) => ({ value: v, label: compact(v) })),
        bottom: scale.bottom,
        top: scale.top,
        from: formatDay(s.points[0].date),
        to: formatDay(s.points.at(-1)!.date),
      };
    });

  if (weeks.length === 0) return null;
  return (
    <>
      <Card icon={<Footprints className="size-4 text-run" aria-hidden />} title="Running each week">
        <WeekBars
          bars={runBars}
          ticks={runScale.values.map((v) => ({ value: v, label: formatMinutesShort(v) }))}
          colour="run"
          legend={{ value: "Done", ghost: "Planned" }}
          caption="Week"
        />
      </Card>
      {lifted && (
        <Card icon={<Dumbbell className="size-4 text-strength" aria-hidden />} title={`Weight lifted each week (${weightUnit})`}>
          <WeekBars bars={liftBars} ticks={liftScale.values.map((v) => ({ value: v, label: compact(v) }))} colour="strength" caption="Week" />
          <p className="mt-2 text-xs text-muted-foreground">Weight × reps across your working sets.</p>
        </Card>
      )}
      {lines.length > 0 && (
        <Card icon={<TrendingUp className="size-4 text-strength" aria-hidden />} title="Lift progress">
          <LiftLines series={lines} />
          <p className="mt-2 text-xs text-muted-foreground">Your strongest set each workout: estimated max for weighted lifts, most reps for bodyweight ones. Tap a point to see the set.</p>
        </Card>
      )}
    </>
  );
}
