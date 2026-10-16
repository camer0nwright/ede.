"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { tailorNextWeek } from "@/app/session/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";

/** From Friday: let the AI coach adapt next week to how this week went (SPEC decision 51). */
export function TailorCard({ weekNumber }: { weekNumber: number }) {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const tailor = () =>
    startTransition(async () => {
      setErrors([]);
      const r = await tailorNextWeek();
      if (!r.ok) return setErrors(r.errors);
      setResult(r.summary);
      router.refresh();
    });

  return (
    <section aria-label="Next week" className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="size-4 text-primary-strong" aria-hidden /> {result ? `Week ${weekNumber} is ready` : "Plan next week with your coach"}
      </h2>
      {result ? (
        <>
          <p className="mt-1 text-sm">{result}</p>
          <Link href={`/plan/week/${weekNumber}`} className="mt-3 inline-block text-sm font-medium text-primary-strong">
            See week {weekNumber}
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Your coach looks at how this week went (what you did, how hard it felt, your notes and any skips) and adjusts week {weekNumber} if it
            needs it. ede.&apos;s training rules check every change.
          </p>
          {errors.length > 0 && (
            <div className="mt-3">
              <Note tone="caution">{errors.join(" ")}</Note>
            </div>
          )}
          <Button className="mt-4 h-11 w-full rounded-xl font-semibold" onClick={tailor} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Your coach is planning week {weekNumber}…
              </>
            ) : (
              `Tailor week ${weekNumber}`
            )}
          </Button>
        </>
      )}
    </section>
  );
}
