import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { logOut } from "@/app/(flow)/signup/actions";
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
import { builtWeeks, getInjuryHistory, getPlanContext, getSavedAthlete } from "@/server/athlete";
import { progressSummary, sessionKey } from "@/lib/checkin";
import { AccountSettings, DeleteMyData } from "@/components/you/account-settings";
import { InjuryBetter } from "@/components/you/injury-better";
import { HealthConsentCard } from "@/components/you/health-consent-card";
import { SignInSecurity } from "@/components/you/sign-in-security";
import { accountSessions } from "@/server/auth";
import { LegalLinks } from "@/components/legal-page";

export const metadata = { title: "You · ede." };

const EXPERIENCE = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;
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
  const [pastInjuries, devices] = ctx.athleteId
    ? await Promise.all([getInjuryHistory(ctx.athleteId), ctx.email ? accountSessions(ctx.athleteId) : null])
    : [[], null];
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
  const dueKeys = builtWeeks(ctx).flatMap((b) => b.week.sessions.filter((x) => x.date <= ctx.today).map((x) => sessionKey(x.date, x.slot)));
  const progress = progressSummary(dueKeys, ctx.checkIns);
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
      rows: [[ctx.title, ctx.goal], ...(input.targetDate ? ([["Race day", formatDate(input.targetDate)]] as [string, string][]) : [])],
    },
    {
      id: "training",
      rows: [
        ["Experience", EXPERIENCE[input.experienceLevel]],
        ["Runs a week", String(input.runsPerWeek ?? "-")],
        ["Paces from", five ? `5K in ${five}` : "An estimate (add a recent race time)"],
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
    <main className="flex flex-col gap-4 pt-6">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-eyebrow text-muted-foreground">
            {ctx.title} · {ctx.goal}
          </p>
          <h1 className="mt-2 truncate text-5xl font-medium tracking-tighter md:text-6xl">{ctx.name}</h1>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary font-heading text-xl font-semibold text-primary-foreground" aria-hidden>
          {ctx.name.trim().charAt(0).toUpperCase() || "e"}
        </span>
      </header>

      {ctx.isDemo && <DemoBanner />}
      {query.saved && !ctx.isDemo && (
        <Note>
          {index < 0
            ? "Saved. Your plan has been rebuilt with your changes."
            : `Saved. Your plan changes from Monday ${formatDate(nextMonday)}; this week stays as it is.`}
        </Note>
      )}
      {typeof query.injury === "string" && INJURY_NOTES[query.injury] && <Note>{INJURY_NOTES[query.injury]}</Note>}

      <section aria-label="Plan progress" className="bg-panel p-6 text-panel-foreground">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label-eyebrow text-primary">Your progress</p>
          <span className="text-xs text-panel-muted">
            {weeksToRace !== null && weeksToRace >= 0
              ? weeksToRace === 0
                ? "Race week"
                : `${plural(weeksToRace, "week")} to race day`
              : `${plural(total, "week")} planned`}
          </span>
        </div>
        <h2 className="mt-3 text-[28px] leading-tight font-medium">
          {index < 0 ? `Starts ${formatDate(input.startDate)}` : `Week ${Math.min(index + 1, total)} of ${total}`}
        </h2>
        <div className="mt-4 h-1 overflow-hidden bg-white/15" aria-hidden>
          <div
            className="h-full bg-primary"
            style={{
              width: `${(Math.min(Math.max(index + 1, 0), total) / total) * 100}%`,
            }}
          />
        </div>
        <p className="mt-3 text-sm text-panel-muted">
          {index < 0 ? `${total}-week plan` : `${PHASE_LABEL[current.phase]} phase`}.
          {progress.due > 0 && (
            <>
              {" "}
              {progress.done} of {plural(progress.due, "session")} done so far{progress.skipped > 0 && `, ${progress.skipped} skipped`}.
            </>
          )}
        </p>
        {!ctx.isDemo && (
          <Link href="/you/history" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
            History and records <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </section>

      {!ctx.isDemo && (
        <section aria-label="Injuries" className={injury ? "border border-hard/30 bg-hard/10 p-6" : "border bg-card p-6"}>
          <h2 className="font-heading text-xl font-medium tracking-tight">Injuries</h2>
          {injury ? (
            <div className="mt-2">
              <p className="font-medium capitalize">
                {injury.area} · {injury.painLevel}/10
              </p>
              <p className="text-sm text-muted-foreground">Since {formatDate(injury.since)}</p>
              <p className="mt-2 text-sm">{bandSummary(injury)}</p>
              {injuryBand(injury) !== "mild" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {injuryBand(injury) === "severe"
                    ? "Please see a doctor before training."
                    : "A physio or doctor can help you get back sooner."}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button asChild variant="secondary" className="h-11 flex-1 rounded-xl">
                  <Link href="/you/injury">Update</Link>
                </Button>
                <InjuryBetter
                  area={injury.area === "other" ? "injury" : injury.area}
                  restart={restart}
                  share={returnShare(Math.max(1, Math.ceil(daysBetween(injury.since, ctx.today) / 7)), injuryBand(injury) === "mild")}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Nothing hurting. If something starts to, your plan adapts from that day.</p>
              <RowLink href="/you/injury">Report an injury</RowLink>
            </>
          )}
          {pastInjuries.length > 0 && (
            <>
              <h3 className="mt-5 text-sm text-muted-foreground">Past injuries</h3>
              <ul className="mt-1 divide-y border-t text-sm">
                {pastInjuries.map((p) => (
                  <li key={p.id} className="flex justify-between gap-4 py-3 last:pb-0">
                    <span className="capitalize">
                      {p.area} · {p.painLevel}/10
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(p.since)} – {formatDate(p.until)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
            <li key={DAY_NAMES[i]} className={`py-2 ${d.minutes === null ? "bg-secondary/50" : "bg-secondary"}`}>
              <span className="block text-[11px] text-muted-foreground">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className={`mt-1 block text-sm tabular-nums ${d.minutes === null ? "text-muted-foreground" : "font-medium"}`}>
                {d.minutes === null ? "Rest" : formatDayMinutes(d.minutes, ultra)}
              </span>
              {d.isDouble && <span className="block text-[11px] text-primary-strong">×2</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          {plural(summary.trainingDays, "training day")}, {plural(summary.doubleDays, "double day")},{" "}
          {plural(summary.restDays, "full rest day")}.
        </p>
      </Section>

      {saved && (
        <section aria-label="Settings" className="border bg-card p-6">
          <h2 className="mb-3 font-heading text-xl font-medium tracking-tight">Settings</h2>
          <AccountSettings
            initial={{ name: saved.name ?? "", weightUnit: saved.weightUnit === "lb" ? "lb" : "kg", distanceUnit: saved.distanceUnit === "mi" ? "mi" : "km" }}
          />
        </section>
      )}

      {saved && (
        <HealthConsentCard
          consentedOn={ctx.healthConsentAt}
          hasHealthData={!!ctx.injury || pastInjuries.length > 0 || !!saved.injuryHistory}
        />
      )}

      </div>

      <section aria-label="Account" className="border bg-card p-6">
        <h2 className="font-heading text-xl font-medium tracking-tight">Account</h2>
        {ctx.isDemo ? (
          <div className="mt-3 divide-y border-t">
            <Link href="/onboarding" className="flex items-center justify-between py-3 text-sm font-medium">
              Set up your own plan <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            <Link href="/login" className="flex items-center justify-between pt-3 text-sm font-medium">
              Log in <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            {ctx.email && <p className="mt-1 text-sm text-muted-foreground">Signed in as {ctx.email}</p>}
            <div className="mt-3 divide-y border-t">
              <Link href="/onboarding" className="flex items-center justify-between py-3 text-sm font-medium">
                Start a new plan from scratch <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
              {devices && <SignInSecurity otherDevices={devices.others} />}
              {/* A plain link: the browser downloads the file the route sends. */}
              <a href="/you/export" download className="flex items-center justify-between py-3 text-sm font-medium">
                Download my data <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </a>
              <form action={logOut}>
                <button type="submit" className="flex w-full items-center justify-between py-3 text-sm font-medium">
                  Log out <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </form>
              <DeleteMyData />
            </div>
          </>
        )}
      </section>

      <MedicalNotice />
      <LegalLinks className="-mt-4 text-center text-xs text-muted-foreground" />
    </main>
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-medium">
      {children} <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function Section({ id, editable, children }: { id: SectionId; editable: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={SECTIONS[id].title} className="border bg-card p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-medium tracking-tight">{SECTIONS[id].title}</h2>
        {editable && (
          <Link href={`/you/edit/${id}`} className="-mr-1 flex items-center text-sm font-medium text-primary-strong">
            Edit <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
