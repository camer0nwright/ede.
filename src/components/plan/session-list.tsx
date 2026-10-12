"use client";

import { useState } from "react";
import { Dumbbell, Footprints } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EASY_MAX_RPE } from "@/lib/domain";
import { formatMinutes, INTENSITY_COLOR, INTENSITY_LABEL } from "@/lib/format";
import type { SessionItem } from "@/lib/outline-view";
import { cn } from "@/lib/utils";

const effortColor = (rpe: number) => (rpe <= EASY_MAX_RPE ? "text-easy" : rpe <= 6 ? "text-moderate" : "text-hard");

const ROLE_LABEL = { quality: "Key session", long: "Long run", easy: "Easy" } as const;

export function SessionList({ items }: { items: SessionItem[] }) {
  const [open, setOpen] = useState<SessionItem | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(item)}
              className="flex w-full items-stretch gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent active:scale-[0.99]"
            >
              <span className={cn("w-1 shrink-0 rounded-full", item.type === "run" ? "bg-run" : "bg-strength")} aria-hidden />
              <span className="flex size-10 shrink-0 items-center justify-center self-center rounded-xl bg-secondary">
                {item.type === "run" ? (
                  <Footprints className="size-5 text-run" aria-hidden />
                ) : (
                  <Dumbbell className="size-5 text-strength" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {/* Effort labels are for runs only; lifts show their focus and accessory set. */}
                  {item.type === "run" ? (
                    <>
                      <span className={cn("font-semibold", INTENSITY_COLOR[item.intensity])}>{INTENSITY_LABEL[item.intensity]}</span>
                      <span>{ROLE_LABEL[item.role]}</span>
                      {item.level && <span>Level {item.level}</span>}
                    </>
                  ) : (
                    <>
                      <span>Accessories {item.variant}</span>
                      {item.effort !== "hard" && <span className="font-semibold">{STRENGTH_EFFORT_LABEL[item.effort]}</span>}
                    </>
                  )}
                </span>
              </span>
              <span className="self-center font-display text-xl">{formatMinutes(item.minutes)}</span>
            </button>
          </li>
        ))}
      </ul>

      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent>
          {open && (
            <div className="mx-auto w-full max-w-md px-4 pb-8">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="font-display text-3xl uppercase">{open.title}</DrawerTitle>
                <DrawerDescription>
                  {formatMinutes(open.minutes)}
                  {open.type === "run" && open.level && ` · Level ${open.level} of ${open.maxLevel}`}
                  {open.type === "strength" && ` · Accessories ${open.variant}`}
                </DrawerDescription>
              </DrawerHeader>
              {open.type === "run" ? (
                <ol className="flex flex-col gap-2">
                  {open.steps.map((step, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                      <span className="font-display text-lg text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 text-sm">{step.name}</span>
                      <span className="text-right text-xs">
                        <span className="block font-medium">{formatMinutes(step.minutes)}</span>
                        <span className={cn("font-semibold", effortColor(step.targetRpe))}>RPE {step.targetRpe}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="rounded-xl bg-secondary p-3">{open.summary}</p>
                  <p className="text-muted-foreground">
                    The exact exercises, sets and weights appear when this week&apos;s plan is generated, based on your
                    equipment and what you lifted last time.
                  </p>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

const STRENGTH_EFFORT_LABEL = { light: "Lighter week", technique: "Technique focus" } as const;
