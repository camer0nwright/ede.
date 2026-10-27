"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { easeBackIn, keepPlan } from "@/app/(app)/session/actions";
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
    <section aria-label="Last week" className="flex flex-col bg-panel p-6 text-panel-foreground">
      <p className="label-eyebrow text-primary">Coach update</p>
      <h2 className="mt-3 text-[28px] leading-tight font-medium">{reason === "time-off" ? "Welcome back." : "Last week got away from you."}</h2>
      <p className="mt-2 flex-1 text-panel-muted">
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
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button className="h-12 rounded-md bg-panel-foreground font-semibold text-panel hover:bg-panel-foreground/90" onClick={() => run("keep")} disabled={pending}>
          {pending && choice === "keep" ? <Loader2 className="animate-spin" /> : "Keep my plan"}
        </Button>
        <Button className="h-12 rounded-md font-semibold" onClick={() => run("ease")} disabled={pending}>
          {pending && choice === "ease" ? <Loader2 className="animate-spin" /> : "Ease back in"}
        </Button>
      </div>
    </section>
  );
}
