"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { updatePlanSettings } from "@/app/you/actions";
import { Note } from "@/components/onboarding/choices";
import { sectionProblem, SECTIONS, toAnswers, type Draft, type SectionId } from "@/components/onboarding/draft";
import { StepExperience, StepGoal, StepStrength, StepWeek } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { safely } from "@/lib/safely";

/** Edits one section of a saved plan, using the same screen as setup. */
export function SectionEditor({ section, initial, started }: { section: SectionId; initial: Draft; started: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const problem = sectionProblem(section, draft);
  const changed = JSON.stringify(toAnswers(draft)) !== JSON.stringify(toAnswers(initial));

  const save = () => {
    setErrors([]);
    startTransition(async () => {
      const result = await safely(() => updatePlanSettings(section, toAnswers(draft)));
      if (result && !result.ok) setErrors(result.errors);
    });
  };

  const props = { draft, update, editing: true };
  return (
    <div className="-mb-24 flex min-h-dvh flex-col pt-4 pb-6">
      <div className="flex items-center gap-2">
        <Link href="/you" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Back to You">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm text-muted-foreground">Edit {SECTIONS[section].title.toLowerCase()}</span>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-6">
        {section === "goal" && <StepGoal {...props} />}
        {section === "training" && <StepExperience {...props} />}
        {section === "lifting" && <StepStrength {...props} />}
        {section === "week" && <StepWeek {...props} />}

        {errors.length > 0 && (
          <Note tone="caution">
            {errors.map((e) => (
              <span key={e} className="block">{e}</span>
            ))}
          </Note>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-background/90 px-4 pt-3 pb-4 backdrop-blur pb-safe">
        <p className="mb-2 text-center text-sm text-muted-foreground">
          {problem ?? (!changed ? "No changes yet" : started ? "Your plan changes from next Monday. This week stays as it is." : "Your plan will be rebuilt with these changes.")}
        </p>
        <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" onClick={save} disabled={pending || problem !== null || !changed}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Updating your plan…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  );
}
