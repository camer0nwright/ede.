import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronLeft, Trophy } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { WorkoutLogger } from "@/components/workout/workout-logger";
import { formatMinutes } from "@/lib/format";
import { buildWorkout, workoutSummary } from "@/lib/workout";
import { loadWorkout, type Workout } from "@/server/workout";

export const metadata = { title: "Workout · ede." };

export default function WorkoutPage({ params }: PageProps<"/workout/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkoutContent params={params} />
    </Suspense>
  );
}

async function WorkoutContent({ params }: { params: PageProps<"/workout/[id]">["params"] }) {
  const { id } = await params;
  const workout = await loadWorkout(id);
  if (!workout) notFound();
  if (workout.status === "in_progress") {
    return (
      <WorkoutLogger
        sessionId={workout.id}
        title={workout.title}
        startedAt={workout.startedAt}
        unit={workout.unit}
        initial={buildWorkout(workout.planned, workout.logged, workout.previous, workout.unit, workout.suggestions)}
        equipment={workout.equipment}
        avoid={workout.avoid}
      />
    );
  }
  if (workout.status !== "completed") redirect("/");
  return <Summary workout={workout} />;
}

/** After a workout: time, sets, weight lifted, what beat last time, and every set. */
function Summary({ workout }: { workout: Workout }) {
  const summary = workoutSummary(workout.logged, workout.previous, workout.unit);
  const blocks = buildWorkout(workout.planned, workout.logged, {}, workout.unit);
  return (
    <main className="flex flex-col gap-4 pt-6">
      <Link href="/" className="-ml-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Today
      </Link>
      <header>
        <p className="label-eyebrow flex items-center gap-1.5 text-easy">
          <Check className="size-3.5" aria-hidden /> Workout done
        </p>
        <h1 className="mt-2 text-5xl font-medium tracking-tighter">{workout.title}</h1>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Time", workout.actualMinutes ? formatMinutes(workout.actualMinutes) : "–"],
          ["Sets", String(summary.sets)],
          [`Lifted (${workout.unit})`, summary.workingSets ? Number(summary.volume).toLocaleString("en-GB") : "–"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse border bg-card p-4">
            <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
            <dd className="font-display text-3xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {summary.improvements.length > 0 && (
        <section aria-label="Better than last time" className="bg-panel p-6 text-panel-foreground">
          <p className="label-eyebrow flex items-center gap-1.5 text-primary">
            <Trophy className="size-3.5" aria-hidden /> Better than last time
          </p>
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {summary.improvements.map((i) => (
              <li key={i.exercise} className="flex justify-between gap-4 py-2.5 last:pb-0">
                <span>{i.exercise}</span>
                <span className="font-medium text-primary">{i.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocks.map((b) => {
        const sets = b.sets.filter((s) => s.done);
        return (
          <section key={b.name} aria-label={b.name} className="border bg-card p-5">
            <h2 className="text-xl font-medium">{b.name}</h2>
            {sets.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Not logged</p>
            ) : (
              <ol className="mt-3 flex flex-col divide-y text-sm">
                {sets.map((s) => (
                  <li key={s.setNumber} className="flex justify-between gap-4 py-2 tabular-nums first:pt-0 last:pb-0">
                    <span className="text-muted-foreground">{s.setType === "warmup" ? "Warm-up" : s.setType === "drop" ? "Drop set" : s.setType === "failure" ? "To failure" : "Working"}</span>
                    <span>
                      {s.weight ? `${s.weight} ${workout.unit} × ` : ""}
                      {s.reps}
                      {s.weight ? "" : " reps"}
                      {s.rpe && <span className="text-muted-foreground"> @ {s.rpe}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {workout.effort && <p className="text-sm text-muted-foreground">Effort {workout.effort}/10.</p>}
      <Link href="/" className="mt-2 grid h-12 place-items-center rounded-md bg-primary font-semibold text-primary-foreground">
        Back to Today
      </Link>
    </main>
  );
}

