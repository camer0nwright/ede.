import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";
import { InjuryBanner } from "@/components/injury-banner";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { PageSkeleton } from "@/components/page-skeleton";
import { TodaySessions, WeekDays, WeekStrip } from "@/components/plan/week-days";
import { daysBetween } from "@/lib/dates";
import { formatLongDate, formatMinutes, PHASE_LABEL, plural } from "@/lib/format";
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
  const upcoming = notStarted ? days : days.filter((d) => d.date > ctx.today);
  const next = upcoming.find((d) => d.sessions.length > 0);
  const runMinutes = week.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0);
  const lifts = week.sessions.filter((s) => s.type === "strength").length;

  return (
    <main className="flex flex-col gap-6 pt-6">
      <header>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{formatLongDate(ctx.today)}</p>
          <Logo size="sm" />
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{notStarted ? "Your first week" : "Today"}</h1>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}

      <WeekStrip days={days} today={ctx.today} />

      {today && today.sessions.length > 0 ? (
        <TodaySessions day={today} />
      ) : (
        <section aria-label="Today" className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{notStarted ? "Starts Monday" : "Rest day"}</p>
          <h2 className="mt-1 text-lg font-semibold">{notStarted ? "Your plan starts soon" : "Nothing planned today"}</h2>
          {next && (
            <p className="mt-1 text-sm text-muted-foreground">
              {notStarted ? "First up" : "Next"}: {next.dayName} · {next.sessions[0].title} · {formatMinutes(next.sessions[0].minutes)}
            </p>
          )}
        </section>
      )}

      <section aria-label="This week" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{notStarted ? "Week 1" : "Rest of the week"}</h2>
          <Link prefetch href={`/plan/week/${week.weekNumber}`} className="-mr-1 flex items-center text-sm font-medium text-primary-strong">
            Week {week.weekNumber} <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {PHASE_LABEL[week.phase]} · {formatMinutes(runMinutes)} running · {plural(lifts, "lift")}
        </p>
        {next ? (
          <WeekDays days={upcoming} today={ctx.today} />
        ) : (
          <p className="border-y py-3 text-sm text-muted-foreground">That&apos;s this week done. Next week is in Plan.</p>
        )}
      </section>

      <MedicalNotice />
    </main>
  );
}
