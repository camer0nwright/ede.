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
import { blockHeadline, formatDate, plural } from "@/lib/format";

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
  const block = blockHeadline(
    weeks.map((w) => w.phase),
    currentWeek,
  );

  return (
    <main className="flex flex-col gap-6 pt-6">
      <header>
        <p className="label-eyebrow text-muted-foreground">
          {ctx.input.targetDate ? `Race day ${formatDate(ctx.input.targetDate)}` : `${weeks.length}-week block`} · {ctx.goal}
        </p>
        <h1 className="mt-2 text-5xl font-medium tracking-tighter md:text-6xl">{ctx.title}</h1>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {ctx.injury && <InjuryBanner injury={ctx.injury} />}

      <section aria-label="Plan overview" className="border border-transparent bg-meadow p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label-eyebrow text-muted-foreground">Training block</p>
          <p className="text-xs text-muted-foreground">
            Week {currentWeek} of {weeks.length} · {ctx.input.targetDate ? `${plural(weeksToGo, "week")} to go` : `started ${formatDate(ctx.input.startDate)}`}
          </p>
        </div>
        <h2 className="mt-3 text-[28px] leading-tight font-medium">{block.title}</h2>
        <p className="mt-1 text-muted-foreground">{block.about}</p>
        <div className="mt-6">
          <PhaseStrip weeks={weeks} currentWeek={currentWeek} ringOffset="ring-offset-meadow" />
        </div>
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

      <section aria-label="Weeks" className="mt-4 flex flex-col gap-3">
        <div>
          <p className="label-eyebrow text-muted-foreground">Your block</p>
          <h2 className="mt-2 text-[32px] leading-tight font-medium">All weeks</h2>
        </div>
        {builtWeeks(ctx).map(({ week, injured }) => (
          <WeekCard key={week.weekNumber} week={week} injured={injured} current={week.weekNumber === currentWeek} />
        ))}
      </section>

      <MedicalNotice />
    </main>
  );
}
