"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { forgetSwap } from "@/app/(flow)/workout/actions";
import { safely } from "@/lib/safely";

/** Swaps kept from workouts, each with an undo (SPEC decision 77). */
export function KeptSwaps({ swaps }: { swaps: [from: string, to: string][] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const undo = (from: string) =>
    startTransition(async () => {
      const result = await safely(() => forgetSwap({ from }));
      if (!result.ok) return void toast(result.errors[0]);
      toast(`Back to ${from} in future sessions.`);
      router.refresh();
    });

  return (
    <section aria-label="Exercise swaps" className="border bg-card p-6">
      <h2 className="font-heading text-xl font-medium tracking-tight">Exercise swaps</h2>
      <p className="mt-1 text-sm text-muted-foreground">Kept from your workouts. Future gym sessions use your choice.</p>
      <ul className="mt-3 divide-y border-t">
        {swaps.map(([from, to]) => (
          <li key={from} className="flex items-center justify-between gap-3 py-3 text-sm last:pb-0">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">{from}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="replaced by" />
              <span className="font-medium">{to}</span>
            </span>
            <button type="button" onClick={() => undo(from)} disabled={pending} className="shrink-0 font-medium text-primary-strong disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : "Undo"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
