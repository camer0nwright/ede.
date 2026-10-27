// The front page for visitors (SPEC decision 63), from the user's Figma design.
// Everything it says is something ede. already does; no made-up quotes.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Note } from "@/components/onboarding/choices";
import runnerPark from "../../../public/landing/runner-park.jpg";
import runnerTrack from "../../../public/landing/runner-track.jpg";

const wrap = "mx-auto w-full max-w-6xl px-4 sm:px-8";
const eyebrow = "label-eyebrow text-muted-foreground";
const inkButton = "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90";
const outlineButton = "inline-flex h-12 items-center justify-center rounded-md border border-foreground/20 px-6 text-sm font-semibold hover:bg-foreground/5";

const POINTS = [
  ["One plan. Two disciplines.", "Running and strength sessions designed together, so every workout moves you towards the same goal."],
  ["Built around your life.", "Tell ede. your schedule, equipment, experience and ambition. Your plan starts from there."],
  ["Adapts as you go.", "Miss a day, feel sore or make faster progress? Your coach reshapes the week without the guilt."],
];

const WEEK = [
  ["M", "12"],
  ["T", "13"],
  ["W", "14"],
  ["T", "15"],
  ["F", "16"],
  ["S", "17"],
  ["S", "18"],
];

/** A small, static picture of the Today screen. */
function AppPreview() {
  return (
    <div className="w-full max-w-sm border bg-card shadow-2xl shadow-black/10" aria-hidden>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="font-heading text-lg font-bold tracking-tight">ede.</span>
        <span className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Today</span>
          <span>Plan</span>
          <span>Coach</span>
        </span>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">JM</span>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="label-eyebrow text-[10px] text-muted-foreground">Wednesday, 14 October</p>
          <p className="mt-1 font-heading text-2xl font-medium tracking-tight">Good morning, Jamie.</p>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px]">
          {WEEK.map(([d, n], i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground">{d}</span>
              <span className={i === 2 ? "grid size-7 place-items-center bg-foreground font-semibold text-background" : "grid size-7 place-items-center"}>{n}</span>
            </span>
          ))}
        </div>
        <div className="bg-primary p-4 text-primary-foreground">
          <div className="flex items-baseline justify-between">
            <p className="label-eyebrow text-[10px]">Run · Moderate</p>
            <p className="text-[11px] font-semibold">35 min</p>
          </div>
          <div className="mt-3 flex h-12 items-end gap-1">
            {[30, 45, 70, 55, 80, 50, 90].map((h, i) => (
              <span key={i} className="flex-1 bg-primary-foreground" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="mt-3 font-heading text-xl font-medium tracking-tight">Tempo run</p>
          <p className="text-[11px] opacity-70">Build the strength to hold a steady pace for longer.</p>
          <span className="mt-3 flex h-9 items-center justify-center gap-1.5 bg-primary-foreground text-xs font-semibold text-primary">
            Start session <ArrowRight className="size-3.5" />
          </span>
        </div>
        {[
          ["Thu", "Easy run", "55 min"],
          ["Fri", "Upper body", "34 min"],
        ].map(([d, t, m]) => (
          <div key={t} className="flex items-center gap-3 border-t pt-3 text-xs">
            <span className="w-8 text-muted-foreground">{d}</span>
            <span className="flex-1 font-medium">{t}</span>
            <span className="text-muted-foreground">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing({ deleted = false }: { deleted?: boolean }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className={`${wrap} flex items-center justify-between py-5`}>
        <Link href="/" aria-label="ede. home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-6">
          <a href="#how" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            How it works
          </a>
          <a href="#why" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Why ede.
          </a>
          <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
            Log in <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      <main>
        {deleted && (
          <div className={`${wrap} pt-2`}>
            <Note>Your data has been deleted.</Note>
          </div>
        )}

        {/* Hero */}
        <section className={`${wrap} grid items-center gap-12 pt-10 pb-20 md:grid-cols-[1.05fr_1fr] md:pt-16 md:pb-28`}>
          <div>
            <p className={`${eyebrow} flex items-center gap-2`}>
              <span className="size-1.5 rounded-full bg-primary-strong" /> Your hybrid training coach
            </p>
            <h1 className="mt-5 text-6xl leading-[0.95] font-medium tracking-tighter sm:text-7xl lg:text-[5.6rem]">Train for all of you.</h1>
            <p className="mt-6 max-w-[30rem] text-lg leading-relaxed text-muted-foreground sm:text-[1.2rem]">
              A running and strength plan that knows your goals, learns your rhythm, and changes when life does.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboarding" className={inkButton}>
                Build my plan <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className={outlineButton}>
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Free while in testing · About 3 minutes to set up ·{" "}
              <Link href="/demo" className="underline underline-offset-4 hover:text-foreground">
                See an example plan
              </Link>
            </p>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden bg-panel sm:aspect-[5/6]">
              <Image src={runnerTrack} alt="A runner mid-stride on a track" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" placeholder="blur" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 pb-24 text-white sm:pb-5">
                <p className="label-eyebrow text-[10px] opacity-80">Today&apos;s focus</p>
                <p className="mt-1 font-heading text-2xl font-medium tracking-tight">Build the engine.</p>
              </div>
            </div>
            <div className="absolute -right-2 -bottom-6 w-44 bg-primary p-5 text-primary-foreground shadow-xl sm:-right-6">
              <p className="label-eyebrow text-[10px]">Week 4</p>
              <p className="mt-1 font-heading text-lg font-medium tracking-tight">Right on track</p>
              <span className="mt-3 block h-1 bg-primary-foreground/20">
                <span className="block h-full w-3/4 bg-primary-foreground" />
              </span>
            </div>
          </div>
        </section>

        {/* Statement band */}
        <section className="bg-panel text-panel-foreground">
          <div className={`${wrap} grid gap-6 py-20 md:grid-cols-[1fr_2fr] md:py-28`}>
            <p className="text-sm text-panel-muted">More capable. More consistent.</p>
            <h2 className="max-w-3xl text-4xl leading-[1.08] font-normal tracking-tighter sm:text-5xl lg:text-6xl">
              Built for people who refuse to choose between strong and fast.
            </h2>
          </div>
        </section>

        {/* Meet your coach */}
        <section id="how" className="scroll-mt-6 py-20 md:py-28">
          <div className={`${wrap} grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end`}>
            <div>
              <p className={eyebrow}>Meet your coach</p>
              <h2 className="mt-4 text-4xl leading-[1.05] font-medium tracking-tighter sm:text-5xl lg:text-6xl">Clarity for every training day.</h2>
            </div>
            <p className="max-w-md leading-relaxed text-muted-foreground">No spreadsheets. No second-guessing. Just the session you need today and a plan that makes sense tomorrow.</p>
          </div>
          <div className={`${wrap} mt-12`}>
            <div className="grid items-center gap-10 bg-stage px-5 py-12 sm:px-12 md:grid-cols-[1fr_auto_1fr] md:py-16">
              <div className="text-sm md:self-start">
                <p className="text-[11px] text-muted-foreground">01</p>
                <p className="mt-1 max-w-[12rem] font-medium">Your complete week, at a glance.</p>
              </div>
              <div className="flex justify-center">
                <AppPreview />
              </div>
              <div className="text-sm md:self-end md:justify-self-end">
                <p className="text-[11px] text-muted-foreground">02</p>
                <p className="mt-1 max-w-[12rem] font-medium">Every session has a clear purpose.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why ede. */}
        <section id="why" className={`${wrap} grid scroll-mt-6 gap-10 pb-24 md:grid-cols-[1fr_1.6fr] md:pb-32`}>
          <div>
            <p className={eyebrow}>Why ede.</p>
            <h2 className="mt-4 text-4xl leading-[1.05] font-medium tracking-tighter sm:text-5xl lg:text-6xl">Coaching that keeps up.</h2>
          </div>
          <ol className="divide-y border-y">
            {POINTS.map(([title, body], i) => (
              <li key={title} className="grid gap-2 py-6 sm:grid-cols-[2.5rem_1fr_1.2fr] sm:gap-6">
                <span className="text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-xl font-medium">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* One plan, not two */}
        <section className="bg-meadow">
          <div className={`${wrap} grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24`}>
            <div className="relative aspect-[3/4] overflow-hidden bg-panel">
              <Image src={runnerPark} alt="A runner on a park path" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" placeholder="blur" />
            </div>
            <div>
              <p className={eyebrow}>One plan, not two</p>
              <p className="mt-5 font-heading text-3xl leading-[1.15] font-medium tracking-tight sm:text-4xl">
                Stop piecing together a running plan and a gym plan that fight over your legs. ede. gives you one week that actually works.
              </p>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
                Hard runs and heavy leg days are kept apart, weights go up when you&apos;re ready, and the plan eases off around injuries before building you back up.
              </p>
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className={`${wrap} py-24 md:py-32`}>
          <p className={eyebrow}>Your next block starts here</p>
          <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-6xl leading-[0.98] font-medium tracking-tighter sm:text-7xl lg:text-[5.6rem]">Strong. Fast. Yours.</h2>
              <p className="mt-5 max-w-md text-muted-foreground">Build a balanced plan around the athlete you want to become.</p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <Link href="/onboarding" className={inkButton}>
                Start training <ArrowRight className="size-4" />
              </Link>
              <p className="text-xs text-muted-foreground">Free while in testing</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className={`${wrap} flex flex-col gap-6 py-10 text-sm sm:flex-row sm:items-start sm:justify-between`}>
          <div className="max-w-xs">
            <Logo size="sm" />
            <p className="mt-3 text-xs text-muted-foreground">A hybrid training coach for people who lift and run.</p>
            <p className="mt-2 text-xs text-muted-foreground">General training guidance, not medical advice. If you have pain or an injury, see a doctor or physio.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <a href="mailto:hello@trainwithede.com" className="hover:text-foreground">
              Contact
            </a>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">© 2026 ede.</p>
        </div>
      </footer>
    </div>
  );
}
