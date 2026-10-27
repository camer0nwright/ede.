import { Suspense } from "react";
import { Info } from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";
import { InjuryBanner } from "@/components/injury-banner";
import { PageSkeleton } from "@/components/page-skeleton";
import { PhaseStrip } from "@/components/plan/phase-strip";
import { WeekCard } from "@/components/plan/week-card";
import { MedicalNotice } from "@/components/medical-notice";
import { daysBetween } from "@/lib/dates";
import { builtWeeks, getPlanContext } from "@/server/athlete";
import { formatDate, plural } from "@/lib/format";

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
    <main className="flex flex-col gap-6 pt-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {ctx.input.targetDate ? `Race day ${formatDate(ctx.input.targetDate)}` : `${weeks.length}-week block`} · {ctx.goal}
        </p>
        <h1 className="mt-1 text-4xl font-medium tracking-tighter">{ctx.title}</h1>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}

      <section aria-label="Plan overview" className="flex flex-col gap-3">
        <p className="flex items-baseline justify-between text-sm">
          <span>
            Week <span className="font-display text-xl tabular-nums">{currentWeek}</span> of {weeks.length}
          </span>
          <span className="text-muted-foreground">
            {ctx.input.targetDate ? `${plural(weeksToGo, "week")} to go` : `Started ${formatDate(ctx.input.startDate)}`}
          </span>
        </p>
        <PhaseStrip weeks={weeks} currentWeek={currentWeek} />
      </section>

      {notes.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {notes.map((n) => (
            <li key={n} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Weeks" className="flex flex-col gap-2">
        <h2 className="font-semibold">All weeks</h2>
        {builtWeeks(ctx).map(({ week, injured }) => (
          <WeekCard key={week.weekNumber} week={week} injured={injured} current={week.weekNumber === currentWeek} />
        ))}
      </section>

      <MedicalNotice />
    </main>
  );
}
