"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { markInjuryBetter } from "@/app/you/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { safely } from "@/lib/safely";

/** "It's better": explains the gentle return, then rebuilds the plan from next Monday. */
export function InjuryBetter({ area, restart, share }: { area: string; restart: string; share: number }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      const result = await safely(() => markInjuryBetter());
      if (result && !result.ok) setErrors(result.errors);
    });

  return (
    <>
      <Button className="h-11 flex-1 rounded-xl" onClick={() => setOpen(true)}>
        It&apos;s better
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-4 pb-8">
            <DrawerHeader className="px-0 text-left! md:text-left">
              <DrawerTitle className="text-2xl font-semibold">Glad your {area} is better</DrawerTitle>
              <DrawerDescription>Your plan restarts gently {restart}.</DrawerDescription>
            </DrawerHeader>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              <li>Running comes back at about {Math.round(share * 100)}% of what you were doing before.</li>
              <li>The first week back is easy running only. Harder sessions return after that, starting from easier levels.</li>
              <li>The rest of this week stays as it is.</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">If it starts hurting again, report it and ede. will adapt again.</p>
            {errors.length > 0 && (
              <div className="mt-3">
                <Note tone="caution">{errors.join(" ")}</Note>
              </div>
            )}
            <Button size="lg" className="mt-5 h-12 w-full rounded-xl text-base font-semibold" onClick={confirm} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Rebuilding your plan…
                </>
              ) : (
                "Restart my plan gently"
              )}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
