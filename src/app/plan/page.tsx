import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { PageSkeleton } from "@/components/page-skeleton";
import { PhaseStrip } from "@/components/plan/phase-strip";
import { WeekCard } from "@/components/plan/week-card";
import { MedicalNotice } from "@/components/medical-notice";
import { daysBetween } from "@/lib/dates";
import { getPlanContext } from "@/server/athlete";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Plan · ede." };

export default function PlanPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Plan />
    </Suspense>
  );
}

async function Plan() {
  const ctx = await getPlanContext();
  const { weeks, notes } = ctx.outline;
  const currentWeek = Math.max(1, Math.floor(daysBetween(ctx.input.startDate, ctx.today) / 7) + 1);
  const weeksToGo = weeks.length - currentWeek;

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">Your plan</p>
        <h1 className="font-display text-5xl leading-none uppercase">{ctx.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ctx.input.targetDate ? `${formatDate(ctx.input.targetDate)} · ` : `${weeks.length}-week block · `}
          {ctx.goal}
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-4" aria-label="Plan overview">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm">
            Week <span className="font-display text-2xl">{currentWeek}</span> of {weeks.length}
          </p>
          <p className="text-sm text-muted-foreground">
            {ctx.input.targetDate ? `${weeksToGo} weeks to go` : `Starts ${formatDate(ctx.input.startDate)}`}
          </p>
        </div>
        <PhaseStrip weeks={weeks} currentWeek={currentWeek} />
      </section>

      {ctx.isDemo && <DemoBanner />}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {notes.map((n) => (
            <li key={n} className="rounded-xl border border-moderate/40 bg-moderate/10 p-3">
              {n}
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Weeks" className="flex flex-col gap-2">
        {weeks.map((w) => (
          <WeekCard key={w.weekNumber} week={w} current={w.weekNumber === currentWeek} />
        ))}
      </section>

      <MedicalNotice />
    </main>
  );
}
