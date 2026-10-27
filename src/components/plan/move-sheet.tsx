"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Dumbbell, Footprints, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { moveSession } from "@/app/(app)/session/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { moveTargets, type MoveMode, type MoveTarget } from "@/lib/move";
import { cn } from "@/lib/utils";
import type { DayView, SessionView } from "@/lib/week-view";
import { safely } from "@/lib/safely";

/**
 * Moving a session to another day of its week: pick a day, choose swap or
 * both if it's taken, and see any warnings before it moves (SPEC decision 48).
 */
export function MovePanel({
  session,
  week,
  today,
  toToday,
  onBack,
  onClose,
}: {
  session: SessionView;
  week: DayView[];
  today: string;
  toToday: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const targets = moveTargets(
    { weekStart: week[0].date, sessions: week.flatMap((d) => d.sessions) },
    { date: session.date, slot: session.slot },
    today,
    (s) => !!s.checkIn || (s.type === "strength" && !!s.workout),
  );
  const todayTarget = targets.find((t) => t.date === today);
  const [day, setDay] = useState<MoveTarget | undefined>(toToday ? todayTarget : undefined);
  const [warnings, setWarnings] = useState<{ mode: MoveMode; list: string[] } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const move = (target: MoveTarget, mode: MoveMode, confirm = false) => {
    setErrors([]);
    startTransition(async () => {
      const result = await safely(() => moveSession({ date: session.date, slot: session.slot, to: target.date, mode, confirm }));
      if (!result.ok) return setErrors(result.errors);
      if (!result.moved) return setWarnings({ mode, list: result.warnings });
      router.refresh();
      toast(target.date === today ? `${session.title} moved to today.` : `${session.title} moved to ${target.dayName}.`);
      onClose();
    });
  };

  const choose = (target: MoveTarget) => {
    setDay(target);
    setWarnings(null);
    if (target.modes.length === 1 && target.modes[0] === "move") move(target, "move");
  };

  const body = () => {
    if (day && warnings) {
      return (
        <>
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-moderate" aria-hidden /> Before you move it
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {warnings.list.map((w) => (
              <li key={w} className="rounded-xl bg-moderate/10 px-4 py-3">
                {w}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-12 rounded-xl" onClick={() => (toToday ? onBack() : setWarnings(null))} disabled={pending}>
              {toToday ? "Keep it where it is" : "Pick another day"}
            </Button>
            <Button className="h-12 rounded-xl font-semibold" onClick={() => move(day, warnings.mode, true)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : "Move anyway"}
            </Button>
          </div>
        </>
      );
    }
    if (day && day.modes.includes("both")) {
      const other = day.sessions[0];
      return (
        <>
          <h3 className="font-semibold">
            {day.date === today ? "Today" : day.dayName} already has {other.title.toLowerCase()}
          </h3>
          <div className="flex flex-col gap-2">
            {day.modes.includes("swap") && (
              <OptionButton
                icon={<ArrowLeftRight className="size-4" aria-hidden />}
                title="Swap days"
                description={`${other.title} moves to ${week.find((d) => d.date === session.date)?.dayName ?? "this session's day"}.`}
                onClick={() => move(day, "swap")}
                disabled={pending}
              />
            )}
            <OptionButton
              icon={<Plus className="size-4" aria-hidden />}
              title="Do both that day"
              description={session.type !== other.type ? "Run first, then lift at least 6 hours later." : "Two of the same kind in a day is a lot; ede. will say if it's too much."}
              onClick={() => move(day, "both")}
              disabled={pending}
            />
          </div>
          {!toToday && (
            <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setDay(undefined)}>
              Pick another day
            </button>
          )}
        </>
      );
    }
    if (day && day.modes.includes("move")) {
      return (
        <>
          <h3 className="font-semibold">Move {session.title.toLowerCase()} to {day.date === today ? "today" : day.dayName}?</h3>
          <Button className="h-12 rounded-xl font-semibold" onClick={() => move(day, "move")} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : day.date === today ? "Move to today" : `Move to ${day.dayName}`}
          </Button>
        </>
      );
    }
    if (toToday) {
      // Today is full (two sessions): nothing to do but go back.
      return <Note>Today already has two sessions, so this one can&apos;t join them. Try another day.</Note>;
    }
    return (
      <>
        <h3 className="font-semibold">Move to which day?</h3>
        <ol className="flex flex-col gap-1.5">
          {targets.map((t) => {
            const disabled = t.modes.length === 0 || pending;
            const reason = t.date === session.date ? "Now" : t.date < today ? "Past" : t.sessions.length >= 2 ? "Full" : "";
            return (
              <li key={t.date}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(t)}
                  className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left", disabled ? "opacity-45" : "hover:bg-accent")}
                >
                  <span className="w-24 shrink-0 text-sm font-medium">{t.date === today ? "Today" : t.dayName}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-muted-foreground">
                    {t.sessions.length === 0
                      ? "Rest"
                      : t.sessions.map((s) => (
                          <span key={s.title} className="flex items-center gap-1 truncate">
                            {s.type === "run" ? <Footprints className="size-3.5 text-run" aria-hidden /> : <Dumbbell className="size-3.5 text-strength" aria-hidden />}
                            {s.title}
                          </span>
                        ))}
                  </span>
                  {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </>
    );
  };

  return (
    <div className="mt-6 flex flex-col gap-4 border-t pt-5">
      {body()}
      {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
      {pending && !warnings && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your week…
        </p>
      )}
      <Button variant="secondary" className="h-12 rounded-xl" onClick={onBack} disabled={pending}>
        Back
      </Button>
    </div>
  );
}

function OptionButton({ icon, title, description, onClick, disabled }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent disabled:opacity-50">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-secondary">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
