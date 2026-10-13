import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";
import { InjuryBanner } from "@/components/injury-banner";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { PageSkeleton } from "@/components/page-skeleton";
import { WeekDays, WeekStrip } from "@/components/plan/week-days";
import { daysBetween } from "@/lib/dates";
import { formatMinutes, formatWeekRange, PHASE_LABEL } from "@/lib/format";
import { weekDays } from "@/lib/week-view";
import { builtWeeks, getPlanContext } from "@/server/athlete";

export default function TodayPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const ctx = await getPlanContext();
  const weeks = builtWeeks(ctx);
  const index = Math.floor(daysBetween(ctx.input.startDate, ctx.today) / 7);
  const notStarted = index < 0;
  const { week } = weeks[Math.min(Math.max(index, 0), weeks.length - 1)];
  const days = weekDays(week, ctx.paces);
  const today = days.find((d) => d.date === ctx.today);
  const next = days.find((d) => d.date > ctx.today && d.sessions.length > 0) ?? (notStarted ? days.find((d) => d.sessions.length > 0) : undefined);
  const runMinutes = week.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0);
  const liftMinutes = week.sessions.filter((s) => s.type === "strength").reduce((sum, s) => sum + s.plannedMinutes, 0);

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <Logo />
        <h1 className="mt-4 font-display text-5xl leading-none uppercase">{notStarted ? "Your first week" : "Today"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Week {week.weekNumber} · {PHASE_LABEL[week.phase]} · {formatWeekRange(week.weekStart)}
        </p>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}

      {today && today.sessions.length > 0 ? (
        <section aria-label="Today's sessions" className="flex flex-col gap-2">
          <WeekDays days={days} today={ctx.today} onlyToday />
        </section>
      ) : (
        <section className="rounded-3xl bg-primary p-5 text-primary-foreground" aria-label="Today">
          <p className="text-xs font-semibold tracking-widest uppercase opacity-70">{notStarted ? "Starts Monday" : "Rest day"}</p>
          <p className="mt-1 font-display text-4xl leading-none uppercase">{next ? next.sessions[0].title : "Enjoy the rest"}</p>
          {next && (
            <p className="mt-2 text-sm font-medium opacity-80">
              Next: {next.dayName} · {formatMinutes(next.sessions[0].minutes)}
            </p>
          )}
        </section>
      )}

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Running this week</dt>
          <dd className="font-display text-3xl">{formatMinutes(runMinutes)}</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Lifting this week</dt>
          <dd className="font-display text-3xl">{formatMinutes(liftMinutes)}</dd>
        </div>
      </dl>

      <section aria-label="This week" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl uppercase">This week</h2>
          <Link prefetch href={`/plan/week/${week.weekNumber}`} className="flex items-center gap-1 text-sm font-medium text-primary-strong">
            Week view <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <WeekStrip days={days} today={ctx.today} />
        <WeekDays days={days} today={ctx.today} />
      </section>

      <MedicalNotice />
    </main>
  );
}
