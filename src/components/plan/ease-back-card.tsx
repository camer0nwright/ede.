"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { easeBackIn, keepPlan } from "@/app/session/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/format";
import { safely } from "@/lib/safely";

/** After a mostly missed week: ease back in from what was actually done, or keep the plan (SPEC decision 50). */
export function EaseBackCard({
  reason,
  done,
  planned,
  startsThisWeek,
}: {
  reason: "time-off" | "missed";
  done: number;
  planned: number;
  startsThisWeek: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"ease" | "keep" | null>(null);
  const run = (which: "ease" | "keep") => {
    setChoice(which);
    setErrors([]);
    startTransition(async () => {
      const result = which === "ease" ? await safely(() => easeBackIn()) : await safely(() => keepPlan());
      if (!result.ok) return setErrors(result.errors);
      toast(which === "ease" ? `Plan adjusted ${startsThisWeek ? "from this week" : "from Monday"}.` : "Plan kept as it is.");
      router.refresh();
    });
  };
  const when = startsThisWeek ? "this week" : "next week";

  return (
    <section aria-label="Last week" className="rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{reason === "time-off" ? "Welcome back" : "Last week got away from you"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You ran {formatMinutes(done)} of the {formatMinutes(planned)} planned last week.{" "}
        {reason === "time-off"
          ? `Easing back in carries your plan on from there, with easy running only ${when}.`
          : `Easing back in carries your plan on from there ${when}, so you don't jump straight back to full load.`}
      </p>
      {errors.length > 0 && (
        <div className="mt-3">
          <Note tone="caution">{errors.join(" ")}</Note>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-11 rounded-xl" onClick={() => run("keep")} disabled={pending}>
          {pending && choice === "keep" ? <Loader2 className="animate-spin" /> : "Keep my plan"}
        </Button>
        <Button className="h-11 rounded-xl font-semibold" onClick={() => run("ease")} disabled={pending}>
          {pending && choice === "ease" ? <Loader2 className="animate-spin" /> : "Ease back in"}
        </Button>
      </div>
    </section>
  );
}
