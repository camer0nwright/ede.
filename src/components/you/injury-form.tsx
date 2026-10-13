"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { saveInjury } from "@/app/you/actions";
import { Note } from "@/components/onboarding/choices";
import type { Draft } from "@/components/onboarding/draft";
import { Heading, InjuryFields } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { bandSummary } from "@/lib/injury";
import { cautionFor } from "@/lib/onboarding";

/** Reports an injury, or updates the active one. */
export function InjuryForm({ initial, updating }: { initial: Draft["injury"]; updating: boolean }) {
  const [injury, setInjury] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const caution = cautionFor({ injury });
  const changed = JSON.stringify(injury) !== JSON.stringify(initial);

  const save = () => {
    setErrors([]);
    startTransition(async () => {
      const result = await saveInjury({ ...injury, notes: injury.notes.trim() || undefined });
      if (result && !result.ok) setErrors(result.errors);
    });
  };

  return (
    <div className="-mb-24 flex min-h-dvh flex-col pt-4 pb-6">
      <div className="flex items-center gap-2">
        <Link href="/you" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-accent" aria-label="Back to You">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm text-muted-foreground">{updating ? "Update injury" : "Report an injury"}</span>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-6">
        <Heading title={updating ? "How is it now?" : "What's hurting?"} sub="ede. adapts your plan from today. Sessions already done stay as they were." />
        <InjuryFields injury={injury} onChange={setInjury} />
        <Note>
          <span className="font-semibold">Your plan: </span>
          {bandSummary(injury)}
        </Note>
        {caution && <Note tone="caution">{caution}</Note>}
        {errors.length > 0 && (
          <Note tone="caution">
            {errors.map((e) => (
              <span key={e} className="block">{e}</span>
            ))}
          </Note>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-background/90 px-4 pt-3 pb-4 backdrop-blur pb-safe">
        <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" onClick={save} disabled={pending || (updating && !changed)}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Adapting your plan…
            </>
          ) : updating ? (
            "Save update"
          ) : (
            "Adapt my plan"
          )}
        </Button>
      </div>
    </div>
  );
}
