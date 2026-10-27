import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { WeekDays, WeekStrip } from "@/components/plan/week-days";
import { builtWeeks, getPlanContext } from "@/server/athlete";
import { formatMinutes, formatWeekRange, PHASE_COLOR, PHASE_LABEL } from "@/lib/format";
import { weekDays } from "@/lib/week-view";
import type { Phase } from "@/lib/domain";
import { cn } from "@/lib/utils";

const PHASE_NOTE: Record<Phase, string> = {
  base: "Building your aerobic base and getting used to the routine.",
  build: "Steadily adding running, with harder sessions that progress each time they come round.",
  peak: "Your biggest weeks. Recover well between sessions.",
  recovery: "A lighter week so your body can absorb the training. Same habits, less load.",
  taper: "Cutting volume and keeping a little intensity so you arrive fresh.",
};

export async function generateMetadata({ params }: PageProps<"/plan/week/[week]">): Promise<Metadata> {
  const { week } = await params;
  return { title: /^\d{1,3}$/.test(week) ? `Week ${week} · ede.` : "ede." };
}

// The week number comes from the URL and the plan from the athlete's cookie,
// so the content streams in behind a skeleton while the frame shows instantly.
export default function WeekPage({ params }: PageProps<"/plan/week/[week]">) {
  return (
    <main className="flex flex-col gap-6 pt-6">
      <Suspense fallback={<WeekSkeleton />}>
        <WeekContent params={params} />
      </Suspense>
    </main>
  );
}

function WeekSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading week">
      <div className="h-5 w-24 rounded bg-muted" />
      <div className="h-12 w-40 rounded bg-muted" />
      <div className="h-14 rounded bg-muted" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded bg-muted" />
      ))}
    </div>
  );
}

async function WeekContent({ params }: { params: PageProps<"/plan/week/[week]">["params"] }) {
  const { week: param } = await params;
  const ctx = await getPlanContext();
  const week = ctx.outline.weeks.find((w) => String(w.weekNumber) === param);
  if (!week) notFound();

  const { week: built, injured } = builtWeeks(ctx)[week.weekNumber - 1];
  const summary = ctx.weekSummaries[built.weekStart];
  const days = weekDays(built, ctx.paces, ctx.checkIns, ctx.workouts);
  const runs = built.sessions.filter((s) => s.type === "run");
  const prev = week.weekNumber > 1 ? week.weekNumber - 1 : null;
  const next = week.weekNumber < ctx.outline.weeks.length ? week.weekNumber + 1 : null;

  return (
    <>
      <nav className="flex items-center justify-between text-sm">
        <Link href="/plan" className="-ml-1 flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Plan
        </Link>
        <span className="flex gap-4">
          {prev && <Link prefetch href={`/plan/week/${prev}`} className="text-muted-foreground hover:text-foreground">Week {prev}</Link>}
          {next && <Link prefetch href={`/plan/week/${next}`} className="font-medium text-primary-strong">Week {next}</Link>}
        </span>
      </nav>

      <header>
        <p className="label-eyebrow flex items-center gap-1.5 text-muted-foreground">
          <span className={cn("size-2 rounded-full", PHASE_COLOR[week.phase])} aria-hidden />
          {PHASE_LABEL[week.phase]} · {formatWeekRange(week.weekStart)}
        </p>
        <h1 className="mt-2 text-5xl font-medium tracking-tighter">Week {week.weekNumber}</h1>
        <p className="mt-2 text-muted-foreground">{PHASE_NOTE[week.phase]}</p>
      </header>

      {(summary || built.coachNote) && (
        <section aria-label="From your coach" className={cn("p-6", injured ? "border border-hard/30 bg-hard/10" : "bg-panel text-panel-foreground")}>
          <p className={cn("label-eyebrow flex items-center gap-1.5", injured ? "text-hard" : "text-primary")}>
            <Sparkles className="size-3.5" aria-hidden /> From your coach
          </p>
          {built.coachNote && <p className="mt-3 font-heading text-xl leading-snug font-medium tracking-tight">{built.coachNote}</p>}
          {summary && <p className={cn("mt-2 text-sm", injured ? "text-muted-foreground" : "text-panel-muted")}>{summary}</p>}
        </section>
      )}

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Running", formatMinutes(runs.reduce((sum, r) => sum + r.plannedMinutes, 0))],
          ["Runs", String(runs.length)],
          ["Lifts", String(built.sessions.length - runs.length)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse border bg-card p-4">
            <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
            <dd className="font-display text-3xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Sessions by day" className="mt-2 flex flex-col gap-4">
        <div>
          <p className="label-eyebrow text-muted-foreground">Day by day</p>
          <h2 className="mt-2 text-[32px] leading-tight font-medium">Sessions</h2>
        </div>
        <div className="border bg-card p-5">
          <WeekStrip days={days} today={ctx.today} />
        </div>
        <WeekDays days={days} options={{ canCheckIn: !ctx.isDemo, today: ctx.today, unit: ctx.paces.unit, week: days }} showRest />
      </section>
    </>
  );
}
