import { Suspense } from "react";
import Link from "next/link";
import { resetToDemo } from "@/app/onboarding/actions";
import { DemoBanner } from "@/components/demo-banner";
import { MedicalNotice } from "@/components/medical-notice";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { DAY_NAMES, summariseAvailability } from "@/lib/domain";
import { formatDate, formatDayMinutes, plural } from "@/lib/format";
import { getPlanContext } from "@/server/athlete";

export const metadata = { title: "You · ede." };

const EXPERIENCE = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
const VOLUME = { low: "Low (recommended for hybrid athletes)", moderate: "Moderate", high: "Higher" } as const;

export default function YouPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <You />
    </Suspense>
  );
}

async function You() {
  const ctx = await getPlanContext();
  const { input } = ctx;
  const summary = summariseAvailability(input.availability);
  const rows: [string, string][] = [
    ["Goal", ctx.goal],
    ...(input.targetDate ? ([["Race day", formatDate(input.targetDate)]] as [string, string][]) : []),
    ["Experience", EXPERIENCE[input.experienceLevel]],
    ["Strength volume", VOLUME[input.strengthVolume]],
  ];

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">You</p>
        <h1 className="font-display text-5xl leading-none uppercase">{ctx.name}</h1>
      </header>

      {ctx.isDemo && <DemoBanner />}

      <dl className="divide-y rounded-2xl border bg-card">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 p-4 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Availability" className="flex flex-col gap-3">
        <h2 className="font-display text-2xl uppercase">Your week</h2>
        <ul className="grid grid-cols-7 gap-1.5 text-center">
          {input.availability.map((d, i) => (
            <li key={DAY_NAMES[i]} className={`rounded-xl p-2 ${d.minutes === null ? "bg-secondary/50" : "border bg-card"}`}>
              <span className="block text-[11px] text-muted-foreground">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className="block font-display text-base">{d.minutes === null ? "Rest" : formatDayMinutes(d.minutes, input.raceDistance === "ultra")}</span>
              {d.isDouble && <span className="block text-[10px] font-semibold text-primary-strong">×2</span>}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")},{" "}
          {plural(summary.restDays, "full rest day")}.
        </p>
      </section>

      {ctx.isDemo ? (
        <p className="text-sm text-muted-foreground">Editing your profile arrives in a later step.</p>
      ) : (
        <section className="flex flex-col gap-2">
          <Button asChild variant="secondary" className="h-12 rounded-2xl">
            <Link href="/onboarding">Set up a new plan</Link>
          </Button>
          <form action={resetToDemo}>
            <Button type="submit" variant="ghost" className="h-12 w-full rounded-2xl text-muted-foreground">
              Show the demo on this device
            </Button>
          </form>
        </section>
      )}

      <MedicalNotice />
    </main>
  );
}
