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
import { coachingUpdateNote } from "@/lib/plan-rebuild";
import { weekDays } from "@/lib/week-view";
import type { Phase } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { builtWeeks, easeBack, getPlanContext } from "@/server/athlete";
import { tailorOffer } from "@/server/tailor";

/** The week card's headline, by phase. */
const WEEK_HEADLINE: Record<Phase, string> = {
  base: "Building your base.",
  build: "Building up.",
  peak: "Your hardest weeks.",
  recovery: "A lighter week.",
  taper: "Easing off for race day.",
};

export type TodayQuery = Record<string, string | string[] | undefined>;

/** Today: your plan at /, or the demo athlete's at /demo. */
export async function TodayScreen({ demo = false, query = {} }: { demo?: boolean; query?: TodayQuery }) {
  const ctx = await getPlanContext({ demo });
  const weeks = builtWeeks(ctx);
  const offer = easeBack(ctx);
  const coachingNote = ctx.isDemo ? null : coachingUpdateNote(ctx.outline, ctx.today);
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
          <p className="label-eyebrow text-muted-foreground">{formatLongDate(ctx.today)}</p>
          <Logo size="sm" className="md:hidden" />
        </div>
        <h1 className="mt-2 text-5xl font-medium tracking-tighter md:text-6xl">{notStarted ? "Your first week" : "Today"}</h1>
      </header>

      {query.reset && !ctx.isDemo && <Note>Password changed. Any other devices have been logged out.</Note>}
      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}
      {coachingNote && <Note>{coachingNote}</Note>}
      <div className={cn("grid gap-4", offer && "md:grid-cols-2")}>
        {offer && (
          <EaseBackCard
            reason={offer.reason}
            done={offer.review.doneRunMinutes}
            planned={offer.review.plannedRunMinutes}
            startsThisWeek={offer.start === offer.thisWeek.weekStart}
          />
        )}
        <section aria-label="This week at a glance" className="border bg-card p-6">
          <p className="label-eyebrow text-muted-foreground">
            Week {week.weekNumber} · {PHASE_LABEL[week.phase]}
          </p>
          <h2 className="mt-3 text-[28px] leading-tight font-medium">{notStarted ? "Your first week." : WEEK_HEADLINE[week.phase]}</h2>
          <p className="mt-1 text-muted-foreground">
            {formatMinutes(runMinutes)} running · {plural(lifts, "lift")}
          </p>
          <div className="mt-6">
            <WeekStrip days={days} today={ctx.today} />
          </div>
        </section>
      </div>

      {today && today.sessions.length > 0 ? (
        <div className={cn("grid gap-4", today.sessions.length > 1 && "md:grid-cols-2")}>
          <TodaySessions day={today} options={options} />
        </div>
      ) : (
        <section aria-label="Today" className="border bg-card p-6">
          <p className="label-eyebrow text-muted-foreground">{notStarted ? "Starts Monday" : "Rest day"}</p>
          <h2 className="mt-3 text-[28px] leading-tight font-medium">{notStarted ? "Your plan starts soon." : "Nothing planned today."}</h2>
          {next && (
            <p className="mt-1 text-muted-foreground">
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

      <section aria-label="This week" className="mt-4 flex flex-col gap-3">
        <div>
          <p className="label-eyebrow text-muted-foreground">{notStarted ? `Week ${week.weekNumber}` : "Rest of the week"}</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h2 className="text-[32px] leading-tight font-medium">What&apos;s next</h2>
            <Link prefetch href={`/plan/week/${week.weekNumber}`} className="-mr-1 flex shrink-0 items-center text-sm font-medium text-primary-strong">
              Full week <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
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
