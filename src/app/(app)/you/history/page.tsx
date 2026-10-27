import { Suspense } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, Trophy } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { SKIP_LABEL } from "@/lib/checkin";
import { formatDate, formatMinutes, formatWeekRange, plural } from "@/lib/format";
import { liftRecords, runRecords, weekHistory, weekStreak } from "@/lib/history";
import { formatDistance, formatPace } from "@/lib/paces";
import { formatWeight } from "@/lib/workout";
import { cn } from "@/lib/utils";
import { builtWeeks, getPlanContext } from "@/server/athlete";
import { loadHistory } from "@/server/history";
import { ProgressCharts } from "./progress";

export const metadata = { title: "History · ede." };

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <History />
    </Suspense>
  );
}

const bigNumber = (n: number) => Math.round(n).toLocaleString("en-GB");

async function History() {
  const ctx = await getPlanContext();
  const back = (
    <Link href="/you" className="-ml-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden /> You
    </Link>
  );
  if (ctx.isDemo || !ctx.athleteId) {
    return (
      <main className="flex flex-col gap-6 pt-6">
        {back}
        <h1 className="text-4xl font-medium tracking-tighter">History</h1>
        <p className="text-sm text-muted-foreground">Set up your own plan and check in sessions to see your history and records here.</p>
      </main>
    );
  }

  const { sets, runs, recent } = await loadHistory(ctx.athleteId);
  const unit = ctx.paces.unit;
  const weeks = weekHistory(
    builtWeeks(ctx).map((b) => b.week),
    ctx.checkIns,
    ctx.today,
    sets,
    runs,
  );
  const lifts = liftRecords(sets);
  const runBests = runRecords(runs);
  const done = weeks.reduce((sum, w) => sum + w.done, 0);
  const runMinutes = runs.reduce((sum, r) => sum + r.minutes, 0);
  const distance = runs.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0);
  const liftedKg = weeks.reduce((sum, w) => sum + w.liftedKg, 0);
  const streak = weekStreak(weeks, ctx.today);

  return (
    <main className="flex flex-col gap-4 pt-6">
      {back}
      <header>
        <h1 className="text-4xl font-medium tracking-tighter">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything you&apos;ve checked in, and your best so far.</p>
      </header>

      {done === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          Nothing checked in yet. Mark sessions done (or log a workout) and your history and records build up here.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            {[
              ["Sessions done", String(done)],
              ["Running", formatMinutes(runMinutes) + (distance > 0 ? ` · ${formatDistance(distance, unit)}` : "")],
              [`Lifted (${ctx.weightUnit})`, liftedKg > 0 ? bigNumber(Number(formatWeight(liftedKg, ctx.weightUnit))) : "–"],
              ["Week streak", streak > 0 ? plural(streak, "week") : "–"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse rounded-2xl border bg-card p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-display text-xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {streak >= 2 && (
            <p className="flex items-center gap-2 text-sm">
              <Flame className="size-4 text-strength" aria-hidden /> {streak} weeks in a row with at least half your sessions done.
            </p>
          )}
          <ProgressCharts history={weeks} sets={sets} weightUnit={ctx.weightUnit} distanceUnit={unit} />
        </>
      )}

      {lifts.length > 0 && (
        <section aria-label="Lifting records" className="rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-moderate" aria-hidden /> Lifting records
          </h2>
          <ul className="mt-2 divide-y text-sm">
            {lifts.map((r) => (
              <li key={r.exercise}>
                <Link href={`/workout/${r.best.sessionId}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.exercise}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(r.best.date)} · {plural(r.workouts, "workout")}
                      {r.e1rmKg && ` · est. max ${formatWeight(r.e1rmKg, ctx.weightUnit)} ${ctx.weightUnit}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg tabular-nums">
                    {r.best.weightKg ? `${formatWeight(r.best.weightKg, ctx.weightUnit)} × ${r.best.reps}` : `${r.best.reps} reps`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {runBests && (
        <section aria-label="Running records" className="rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-moderate" aria-hidden /> Running records
          </h2>
          <dl className="mt-2 divide-y text-sm">
            {[
              ["Longest run", formatMinutes(runBests.longest.minutes), runBests.longest.date],
              ...(runBests.farthest ? [["Farthest", formatDistance(runBests.farthest.km, unit), runBests.farthest.date]] : []),
              ...(runBests.fastest
                ? [[`Fastest pace (${formatDistance(runBests.fastest.km, unit)})`, formatPace(runBests.fastest.secondsPerKm, unit), runBests.fastest.date]]
                : []),
            ].map(([label, value, date]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                <dt>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(date)}</span>
                </dt>
                <dd className="font-display text-lg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {!runBests.farthest && <p className="mt-2 text-xs text-muted-foreground">Add distance when you mark runs done to see distance and pace records.</p>}
        </section>
      )}

      {weeks.length > 0 && (
        <section aria-label="Week by week" className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Week by week</h2>
          <ul className="mt-2 divide-y">
            {weeks.map((w) => (
              <li key={w.weekStart}>
                <Link href={`/plan/week/${w.weekNumber}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">Week {w.weekNumber}</span>
                      <span className="text-xs text-muted-foreground">{formatWeekRange(w.weekStart)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-easy" style={{ width: `${w.sessions ? (w.done / w.sessions) * 100 : 0}%` }} />
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {w.done} of {plural(w.sessions, "session")} done
                      {w.skipped > 0 && `, ${w.skipped} skipped`} · {formatMinutes(w.runDone)} of {formatMinutes(w.runPlanned)} running
                      {w.distanceKm > 0 && ` · ${formatDistance(w.distanceKm, unit)}`}
                      {w.liftedKg > 0 && ` · ${bigNumber(Number(formatWeight(w.liftedKg, ctx.weightUnit)))} ${ctx.weightUnit} lifted`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-label="Recent sessions" className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Recent sessions</h2>
          <ul className="mt-2 divide-y text-sm">
            {recent.map((s) => {
              const row = (
                <>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", s.status === "completed" ? "bg-easy/15" : "bg-secondary")}>
                    {s.status === "completed" ? (
                      <Check className="size-4 text-easy" aria-hidden />
                    ) : s.type === "run" ? (
                      <Footprints className="size-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <Dumbbell className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-medium", s.status === "skipped" && "text-muted-foreground line-through")}>{s.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(s.date)} ·{" "}
                      {s.status === "skipped"
                        ? `Skipped · ${SKIP_LABEL[s.skipReason ?? "other"]}`
                        : [
                            s.minutes && formatMinutes(s.minutes),
                            s.distanceKm && formatDistance(s.distanceKm, unit),
                            s.sets > 0 && plural(s.sets, "set"),
                            s.effort && `effort ${s.effort}/10`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={s.id}>
                  {s.type === "strength" && s.status === "completed" ? (
                    <Link href={`/workout/${s.id}`} className="flex items-center gap-3 py-2.5">
                      {row}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-2.5">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
