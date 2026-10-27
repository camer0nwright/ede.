import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Trophy } from "lucide-react";
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
      <header>
        <p className="flex items-center gap-1.5 text-sm font-medium text-easy">
          <Check className="size-4" aria-hidden /> Workout done
        </p>
        <h1 className="mt-1 text-4xl font-medium tracking-tighter">{workout.title}</h1>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Time", workout.actualMinutes ? formatMinutes(workout.actualMinutes) : "–"],
          ["Sets", String(summary.sets)],
          [`Lifted (${workout.unit})`, summary.workingSets ? Number(summary.volume).toLocaleString("en-GB") : "–"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse rounded-2xl border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-display text-2xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {summary.improvements.length > 0 && (
        <section aria-label="Better than last time" className="rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-moderate" aria-hidden /> Better than last time
          </h2>
          <ul className="mt-2 divide-y text-sm">
            {summary.improvements.map((i) => (
              <li key={i.exercise} className="flex justify-between gap-4 py-2 last:pb-0">
                <span>{i.exercise}</span>
                <span className="font-medium text-easy">{i.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocks.map((b) => {
        const sets = b.sets.filter((s) => s.done);
        return (
          <section key={b.name} aria-label={b.name} className="rounded-2xl border bg-card p-4">
            <h2 className="font-semibold">{b.name}</h2>
            {sets.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Not logged</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {sets.map((s) => (
                  <li key={s.setNumber} className="flex justify-between gap-4 tabular-nums">
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
      <Link href="/" className="grid h-12 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
        Back to Today
      </Link>
    </main>
  );
}

