// What the iPhone app shows before sign-in (SPEC decision 81): a single
// screen to start a plan or log in, instead of the website's front page.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Note } from "@/components/onboarding/choices";
import runnerTrack from "../../../public/landing/runner-track.jpg";

export function AppWelcome({ deleted = false }: { deleted?: boolean }) {
  return (
    <main className="app-welcome relative isolate -mt-[env(safe-area-inset-top)] flex min-h-dvh flex-col bg-panel px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-panel-foreground">
      <Image src={runnerTrack} alt="" fill priority sizes="100vw" className="-z-20 object-cover" placeholder="blur" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-panel/30 via-panel/60 to-panel" aria-hidden />

      <div className="pt-6">
        <Logo />
      </div>
      {deleted && (
        <div className="mt-4 text-foreground">
          <Note>Your data has been deleted.</Note>
        </div>
      )}

      <div className="mt-auto">
        <p className="label-eyebrow text-primary">Your hybrid training coach</p>
        <h1 className="mt-3 text-6xl leading-[0.95] font-medium tracking-tighter">Train for all of you.</h1>
        <p className="mt-4 text-lg leading-relaxed text-panel-muted">Running and strength in one plan that changes when life does.</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/onboarding" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground">
            Build my plan <ArrowRight className="size-4" />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-md border border-panel-foreground/30 font-semibold">
            Log in
          </Link>
        </div>
        <p className="mt-5 text-center text-xs text-panel-muted">
          <Link href="/demo" className="underline underline-offset-4">
            See an example plan
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}
