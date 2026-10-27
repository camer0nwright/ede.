// Today (SPEC decisions 46, 62): this week's sessions, what's next, and any
// coach offers. Shown at / when you have a plan, and at /demo for the demo.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";
import { InjuryBanner } from "@/components/injury-banner";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { Note } from "@/components/onboarding/choices";
import { EaseBackCard } from "@/components/plan/ease-back-card";
import { TailorCard } from "@/components/plan/tailor-card";
import { TodaySessions, WeekDays, WeekStrip } from "@/components/plan/week-days";
import { daysBetween } from "@/lib/dates";
import { formatLongDate, formatMinutes, PHASE_LABEL, plural } from "@/lib/format";
import { weekDays } from "@/lib/week-view";
import { builtWeeks, easeBack, getPlanContext } from "@/server/athlete";
import { tailorOffer } from "@/server/tailor";

export type TodayQuery = Record<string, string | string[] | undefined>;

/** Today: your plan at /, or the demo athlete's at /demo. */
export async function TodayScreen({ demo = false, query = {} }: { demo?: boolean; query?: TodayQuery }) {
  const ctx = await getPlanContext({ demo });
  const weeks = builtWeeks(ctx);
  const offer = easeBack(ctx);
  const tailor = tailorOffer(ctx);
  const index = Math.floor(daysBetween(ctx.input.startDate, ctx.today) / 7);
  const notStarted = index < 0;
  const { week } = weeks[Math.min(Math.max(index, 0), weeks.length - 1)];
  const days = weekDays(week, ctx.paces, ctx.checkIns, ctx.workouts);
  const options = { canCheckIn: !ctx.isDemo, today: ctx.today, unit: ctx.paces.unit, week: days };
  const today = days.find((d) => d.date === ctx.today);
  const upcoming = notStarted ? days : days.filter((d) => d.date > ctx.today);
  // Earlier this week, sessions not yet marked done or skipped.
  const missed = ctx.isDemo
    ? []
    : days.filter((d) => d.date < ctx.today).map((d) => ({ ...d, sessions: d.sessions.filter((s) => !s.checkIn) })).filter((d) => d.sessions.length > 0);
  const next = upcoming.find((d) => d.sessions.length > 0);
  const runMinutes = week.sessions.filter((s) => s.type === "run").reduce((sum, s) => sum + s.plannedMinutes, 0);
  const lifts = week.sessions.filter((s) => s.type === "strength").length;

  return (
    <main className="flex flex-col gap-6 pt-6">
      <header>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{formatLongDate(ctx.today)}</p>
          <Logo size="sm" className="md:hidden" />
        </div>
        <h1 className="mt-1 text-5xl font-medium tracking-tighter">{notStarted ? "Your first week" : "Today"}</h1>
      </header>

      {query.reset && !ctx.isDemo && <Note>Password changed. Any other devices have been logged out.</Note>}
      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}
      {offer && (
        <EaseBackCard
          reason={offer.reason}
          done={offer.review.doneRunMinutes}
          planned={offer.review.plannedRunMinutes}
          startsThisWeek={offer.start === offer.thisWeek.weekStart}
        />
      )}

      <WeekStrip days={days} today={ctx.today} />

      {today && today.sessions.length > 0 ? (
        <TodaySessions day={today} options={options} />
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

      {missed.length > 0 && (
        <section aria-label="Still to check in" className="flex flex-col gap-2">
          <h2 className="font-semibold">Still to check in</h2>
          <p className="text-sm text-muted-foreground">Mark these done or skipped so your plan knows how the week went.</p>
          <WeekDays days={missed} options={options} />
        </section>
      )}

      {tailor && <TailorCard weekNumber={tailor.weekNumber} />}

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
          <WeekDays days={upcoming} options={options} />
        ) : (
          <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">That&apos;s this week done. Next week is in Plan.</p>
        )}
      </section>

      <MedicalNotice />
    </main>
  );
}
