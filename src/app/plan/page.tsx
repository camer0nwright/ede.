import { PhaseStrip } from "@/components/plan/phase-strip";
import { WeekCard } from "@/components/plan/week-card";
import { MedicalNotice } from "@/components/medical-notice";
import { daysBetween } from "@/lib/dates";
import { DEMO_ATHLETE, DEMO_TODAY, demoOutline, demoOutlineInput } from "@/lib/demo-athlete";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Plan · ede." };

export default function PlanPage() {
  const { weeks, notes } = demoOutline;
  const currentWeek = Math.floor(daysBetween(demoOutlineInput.startDate, DEMO_TODAY) / 7) + 1;
  const weeksToGo = weeks.length - currentWeek;

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">Your plan</p>
        <h1 className="font-display text-5xl leading-none uppercase">{DEMO_ATHLETE.raceName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(demoOutlineInput.targetDate!)} · {DEMO_ATHLETE.goal}
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-4" aria-label="Plan overview">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm">
            Week <span className="font-display text-2xl">{currentWeek}</span> of {weeks.length}
          </p>
          <p className="text-sm text-muted-foreground">{weeksToGo} weeks to go</p>
        </div>
        <PhaseStrip weeks={weeks} currentWeek={currentWeek} />
      </section>

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
