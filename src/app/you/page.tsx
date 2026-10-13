import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { resetToDemo } from "@/app/onboarding/actions";
import { DemoBanner } from "@/components/demo-banner";
import { MedicalNotice } from "@/components/medical-notice";
import { Note } from "@/components/onboarding/choices";
import { type SectionId, SECTIONS } from "@/components/onboarding/draft";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween } from "@/lib/dates";
import { DAY_NAMES, summariseAvailability } from "@/lib/domain";
import { formatDate, formatDayMinutes, formatDuration, PHASE_LABEL, plural } from "@/lib/format";
import { bandSummary, injuryBand } from "@/lib/injury";
import { mondayOf, returnShare } from "@/lib/plan-rebuild";
import { getInjuryHistory, getPlanContext, getSavedAthlete } from "@/server/athlete";
import { InjuryBetter } from "@/components/you/injury-better";

export const metadata = { title: "You · ede." };

const EXPERIENCE = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
const VOLUME = { low: "Low", moderate: "Moderate", high: "Higher" } as const;

export default function YouPage({ searchParams }: PageProps<"/you">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <You searchParams={searchParams} />
    </Suspense>
  );
}

async function You({ searchParams }: { searchParams: PageProps<"/you">["searchParams"] }) {
  const [ctx, loaded, query] = await Promise.all([getPlanContext(), getSavedAthlete(), searchParams]);
  const pastInjuries = ctx.athleteId ? await getInjuryHistory(ctx.athleteId) : [];
  const { input, outline } = ctx;
  const saved = loaded?.saved;
  const ultra = input.raceDistance === "ultra";
  const summary = summariseAvailability(input.availability);

  // Plan progress: where this week sits in the plan.
  const total = outline.weeks.length;
  const index = Math.floor(daysBetween(input.startDate, ctx.today) / 7);
  const current = outline.weeks[Math.min(Math.max(index, 0), total - 1)];
  const weeksToRace = input.targetDate ? Math.ceil(daysBetween(ctx.today, input.targetDate) / 7) : null;
  const nextMonday = addDays(mondayOf(ctx.today), 7);

  const injury = ctx.injury;
  const restart = index < 0 ? "from the start of your plan" : `from Monday ${formatDate(nextMonday)}`;
  const INJURY_NOTES: Record<string, string> = {
    reported: "Your plan is adapted from today. Check Today and Plan for what's changed.",
    updated: "Updated. Your plan adapts from today.",
    better: `Welcome back. Your plan restarts gently ${restart}.`,
  };

  const five = saved?.recent5kMinutes ? formatDuration(Math.round(saved.recent5kMinutes * 60)) : null;
  const sections: { id: SectionId; rows: [string, string][] }[] = [
    {
      id: "goal",
      rows: [
        [ctx.title, ctx.goal],
        ...(input.targetDate ? ([["Race day", formatDate(input.targetDate)]] as [string, string][]) : []),
      ],
    },
    {
      id: "training",
      rows: [
        ["Experience", EXPERIENCE[input.experienceLevel]],
        ["Runs a week", String(input.runsPerWeek ?? "-")],
        ["Recent 5K", five ?? "Not set"],
      ],
    },
    {
      id: "lifting",
      rows: [
        ["Gym sessions a week", String(input.liftsPerWeek ?? "-")],
        ["Volume", VOLUME[input.strengthVolume]],
        ["Equipment", saved?.equipment ?? "Full gym"],
      ],
    },
  ];

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header>
        <p className="text-sm font-medium text-primary-strong">You</p>
        <h1 className="font-display text-5xl leading-none uppercase">{ctx.name}</h1>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {query.saved && !ctx.isDemo && (
        <Note>{index < 0 ? "Saved. Your plan has been rebuilt with your changes." : `Saved. Your plan changes from Monday ${formatDate(nextMonday)}; this week stays as it is.`}</Note>
      )}

      {typeof query.injury === "string" && INJURY_NOTES[query.injury] && <Note>{INJURY_NOTES[query.injury]}</Note>}

      <section aria-label="Plan progress" className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-70">{index < 0 ? "Starts soon" : `${PHASE_LABEL[current.phase]} phase`}</p>
        <p className="mt-1 font-display text-4xl leading-none uppercase">
          {index < 0 ? `${plural(total, "week")} planned` : `Week ${Math.min(index + 1, total)} of ${total}`}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20" aria-hidden>
          <div className="h-full rounded-full bg-primary-foreground" style={{ width: `${(Math.min(Math.max(index + 1, 0), total) / total) * 100}%` }} />
        </div>
        {weeksToRace !== null && weeksToRace >= 0 && (
          <p className="mt-2 text-sm font-medium opacity-80">{weeksToRace === 0 ? "Race week" : `${plural(weeksToRace, "week")} to race day`}</p>
        )}
        <p className="mt-1 text-xs opacity-70">Session stats arrive with check-ins.</p>
      </section>

      {!ctx.isDemo && (
        <section aria-label="Injuries" className={`rounded-2xl border p-4 ${injury ? "border-hard/40 bg-hard/5" : "bg-card"}`}>
          <h2 className="font-display text-2xl uppercase">Injuries</h2>
          {injury ? (
            <>
              <p className="mt-2 font-medium capitalize">
                {injury.area} · {injury.painLevel}/10
              </p>
              <p className="text-sm text-muted-foreground">Since {formatDate(injury.since)}</p>
              <p className="mt-2 text-sm">{bandSummary(injury)}</p>
              {injuryBand(injury) !== "mild" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {injuryBand(injury) === "severe" ? "Please see a doctor before training." : "A physio or doctor can help you get back sooner."}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button asChild variant="secondary" className="h-11 flex-1 rounded-2xl">
                  <Link href="/you/injury">Update</Link>
                </Button>
                <InjuryBetter
                  area={injury.area === "other" ? "injury" : injury.area}
                  restart={restart}
                  share={returnShare(Math.max(1, Math.ceil(daysBetween(injury.since, ctx.today) / 7)), injuryBand(injury) === "mild")}
                />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Nothing hurting. If something starts to, tell ede. and your plan adapts from that day.</p>
              <Button asChild variant="secondary" className="mt-3 h-11 w-full rounded-2xl">
                <Link href="/you/injury">Report an injury</Link>
              </Button>
            </>
          )}
          {pastInjuries.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">History</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {pastInjuries.map((p) => (
                  <li key={p.id} className="flex justify-between gap-4">
                    <span className="capitalize">
                      {p.area} · {p.painLevel}/10
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(p.since)} – {formatDate(p.until)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {sections.map(({ id, rows }) => (
        <Section key={id} id={id} editable={!ctx.isDemo}>
          <dl className="divide-y">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}

      <Section id="week" editable={!ctx.isDemo}>
        <ul className="grid grid-cols-7 gap-1.5 text-center">
          {input.availability.map((d, i) => (
            <li key={DAY_NAMES[i]} className={`rounded-xl p-1.5 ${d.minutes === null ? "bg-secondary/50" : "bg-secondary"}`}>
              <span className="block text-[11px] text-muted-foreground">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className="block font-display text-sm">{d.minutes === null ? "Rest" : formatDayMinutes(d.minutes, ultra)}</span>
              {d.isDouble && <span className="block text-[10px] font-semibold text-primary-strong">×2</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")}, {plural(summary.restDays, "full rest day")}.
        </p>
      </Section>

      {ctx.isDemo ? (
        <Button asChild className="h-12 rounded-2xl">
          <Link href="/onboarding">Set up your own plan</Link>
        </Button>
      ) : (
        <section className="flex flex-col gap-2">
          <Button asChild variant="secondary" className="h-12 rounded-2xl">
            <Link href="/onboarding">Start a new plan from scratch</Link>
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

function Section({ id, editable, children }: { id: SectionId; editable: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={SECTIONS[id].title} className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase">{SECTIONS[id].title}</h2>
        {editable && (
          <Link href={`/you/edit/${id}`} className="-mr-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-sm font-medium text-primary-strong hover:bg-accent">
            Edit <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
