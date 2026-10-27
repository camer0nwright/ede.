"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { giveHealthConsent, withdrawHealthConsent } from "@/app/(app)/you/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDate } from "@/lib/format";
import { safely } from "@/lib/safely";

/**
 * Injury details are health data (SPEC decision 57). Shows when the athlete
 * agreed to ede. keeping them, with a way to withdraw (which deletes them);
 * or, for details added before agreement was asked, asks for it.
 */
export function HealthConsentCard({ consentedOn, hasHealthData }: { consentedOn?: string; hasHealthData: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  if (!consentedOn && !hasHealthData) return null;

  const run = (action: typeof giveHealthConsent, done: string) =>
    startTransition(async () => {
      const result = await safely(() => action());
      if (!result.ok) return setErrors(result.errors);
      setOpen(false);
      toast(done);
      router.refresh();
    });

  return (
    <section aria-label="Injury details" className="border bg-card p-6">
      <h2 className="flex items-center gap-2 font-heading text-xl font-medium tracking-tight">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> Injury details
      </h2>
      {consentedOn ? (
        <p className="mt-1 text-sm text-muted-foreground">
          You agreed on {formatDate(consentedOn)} to ede. keeping injury details to adjust your plan.{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Injury details are health data, so ede. needs your agreement to keep the ones you&apos;ve added. Without it, they&apos;ll be deleted.
        </p>
      )}
      {errors.length > 0 && (
        <div className="mt-3">
          <Note tone="caution">{errors.join(" ")}</Note>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {!consentedOn && (
          <Button className="h-10 flex-1 rounded-xl" onClick={() => run(giveHealthConsent, "Thanks. Your injury details are kept.")} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : "I agree"}
          </Button>
        )}
        <Button variant="secondary" className="h-10 flex-1 rounded-xl" onClick={() => setOpen(true)} disabled={pending}>
          {consentedOn ? "Withdraw and delete" : "Delete them"}
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-4 pb-8">
            <DrawerHeader className="px-0 text-left! md:text-left">
              <DrawerTitle className="text-[28px] leading-tight font-medium tracking-tight">Delete your injury details?</DrawerTitle>
              <DrawerDescription>This can&apos;t be undone.</DrawerDescription>
            </DrawerHeader>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>Any current injury and past injuries you reported</li>
              <li>The injury history from your setup</li>
              <li>Your plan stops adjusting around them</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">Everything else stays. You can add an injury again later.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-12 rounded-xl" onClick={() => setOpen(false)} disabled={pending}>
                Keep them
              </Button>
              <Button
                className="h-12 rounded-xl bg-destructive text-white hover:bg-destructive/90"
                onClick={() => run(withdrawHealthConsent, "Your injury details are deleted.")}
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : "Delete them"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
