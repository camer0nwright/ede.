import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { SessionList } from "@/components/plan/session-list";
import { daysBetween } from "@/lib/dates";
import { DEMO_TODAY, demoOutline, demoOutlineInput } from "@/lib/demo-athlete";
import { formatMinutes, formatWeekRange, PHASE_LABEL } from "@/lib/format";
import { sessionItems } from "@/lib/outline-view";

export default function TodayPage() {
  const currentWeek = Math.floor(daysBetween(demoOutlineInput.startDate, DEMO_TODAY) / 7) + 1;
  const week = demoOutline.weeks[currentWeek - 1];
  const items = sessionItems(week, demoOutlineInput.strengthVolume);
  const key = items.find((i) => i.type === "run" && i.role === "quality") ?? items[0];

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <Logo />
        <h1 className="mt-4 font-display text-5xl leading-none uppercase">This week</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Week {week.weekNumber} · {PHASE_LABEL[week.phase]} · {formatWeekRange(week.weekStart)}
        </p>
      </header>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground" aria-label="Key session">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-70">Key session</p>
        <p className="mt-1 font-display text-4xl leading-none uppercase">{key.title}</p>
        <p className="mt-2 text-sm font-medium opacity-80">{formatMinutes(key.minutes)}</p>
      </section>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Running this week</dt>
          <dd className="font-display text-3xl">{formatMinutes(week.runMinutes)}</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Lifting this week</dt>
          <dd className="font-display text-3xl">{formatMinutes(week.strengthMinutes)}</dd>
        </div>
      </dl>

      <section aria-label="This week's sessions" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl uppercase">Sessions</h2>
          <Link prefetch href={`/plan/week/${week.weekNumber}`} className="flex items-center gap-1 text-sm font-medium text-primary-strong">
            Week view <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <SessionList items={items} />
      </section>

      <MedicalNotice />
    </main>
  );
}
