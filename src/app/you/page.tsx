import { MedicalNotice } from "@/components/medical-notice";
import { DEMO_ATHLETE, demoOutlineInput } from "@/lib/demo-athlete";
import { DAY_NAMES, summariseAvailability } from "@/lib/domain";
import { formatDate, formatMinutesShort, plural } from "@/lib/format";

export const metadata = { title: "You · ede." };

export default function YouPage() {
  const input = demoOutlineInput;
  const summary = summariseAvailability(input.availability);
  const rows: [string, string][] = [
    ["Goal", DEMO_ATHLETE.goal],
    ["Race day", formatDate(input.targetDate!)],
    ["Experience", "Intermediate"],
    ["Strength volume", "Low (recommended for hybrid athletes)"],
  ];

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">You</p>
        <h1 className="font-display text-5xl leading-none uppercase">{DEMO_ATHLETE.name}</h1>
      </header>

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
            <li key={DAY_NAMES[i]} className={`rounded-xl p-2 ${d.minutes === null ? "bg-secondary/50" : "bg-card border"}`}>
              <span className="block text-[11px] text-muted-foreground">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className="block font-display text-base">{d.minutes === null ? "Rest" : formatMinutesShort(d.minutes)}</span>
              {d.isDouble && <span className="block text-[10px] font-semibold text-primary-strong">×2</span>}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")},{" "}
          {plural(summary.restDays, "full rest day")}.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">Editing your profile and setting up your own plan arrive with onboarding.</p>
      <MedicalNotice />
    </main>
  );
}
