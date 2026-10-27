"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { saveOnboarding } from "@/app/(app)/onboarding/actions";
import { Logo } from "@/components/logo";
import { MedicalNotice } from "@/components/medical-notice";
import { Button } from "@/components/ui/button";
import { cautionFor, OnboardingAnswers } from "@/lib/onboarding";
import { Note } from "./choices";
import { START, STEPS, stepProblem, toAnswers, type Draft } from "./draft";
import { Review, StepExperience, StepGoal, StepInjury, StepStrength, StepWeek, StepYou } from "./steps";
import { safely } from "@/lib/safely";

export function OnboardingFlow() {
  const [draft, setDraft] = useState<Draft>(START);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const step = STEPS[stepIndex];
  const problem = stepProblem(step, draft);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Start each step at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  const answers = useMemo(() => toAnswers(draft), [draft]);
  const caution = cautionFor({ injury: draft.hasInjury ? draft.injury : undefined, injuryHistory: draft.injuryHistory });

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));
  const build = () => {
    const parsed = OnboardingAnswers.safeParse(answers);
    if (!parsed.success) return setErrors(parsed.error.issues.map((i) => i.message));
    setErrors([]);
    startTransition(async () => {
      const result = await safely(() => saveOnboarding(parsed.data));
      if (result && !result.ok) setErrors(result.errors);
    });
  };

  return (
    <div className="-mb-24 flex min-h-dvh flex-col pt-4 pb-6">
      {step !== "welcome" && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={back} className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length - 1} aria-valuenow={stepIndex}>
            <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-xs text-muted-foreground">
            {stepIndex}/{STEPS.length - 1}
          </span>
        </div>
      )}

      <div key={step} className="mt-6 flex flex-1 flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
        {step === "welcome" && (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <Logo />
            <h1 className="text-5xl font-medium tracking-tighter">Run and lift, as one plan</h1>
            <p className="text-lg text-muted-foreground">
              ede. builds your weekly running and lifting together, so they help each other instead of clashing. It
              adapts as your weeks go.
            </p>
            <p className="text-sm text-muted-foreground">About 3 minutes to set up.</p>
            <MedicalNotice />
          </div>
        )}

        {step === "goal" && <StepGoal draft={draft} update={update} />}

        {step === "experience" && <StepExperience draft={draft} update={update} />}

        {step === "strength" && <StepStrength draft={draft} update={update} />}

        {step === "injury" && <StepInjury draft={draft} update={update} />}

        {step === "week" && <StepWeek draft={draft} update={update} />}

        {step === "you" && <StepYou draft={draft} update={update} />}

        {step === "review" && <Review draft={draft} caution={caution} />}

        {errors.length > 0 && (
          <Note tone="caution">
            {errors.map((e) => (
              <span key={e} className="block">{e}</span>
            ))}
          </Note>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-background/90 px-4 pt-3 pb-4 backdrop-blur pb-safe">
        {problem && step !== "welcome" && <p className="mb-2 text-center text-sm text-muted-foreground">{problem}</p>}
        {step === "review" ? (
          <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" onClick={build} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Building your plan…
              </>
            ) : (
              "Build my plan"
            )}
          </Button>
        ) : (
          <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" onClick={next} disabled={problem !== null}>
            {step === "welcome" ? "Get started" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
