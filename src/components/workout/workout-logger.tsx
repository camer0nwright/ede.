"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Loader2, Plus, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { discardWorkout, finishWorkout, logSet, unlogSet } from "@/app/workout/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { EFFORT_LABEL } from "@/lib/checkin";
import { plural } from "@/lib/format";
import type { SetType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { ExerciseBlock, SetRow, WeightUnit } from "@/lib/workout";

const WARMUP_REST_SECONDS = 60;
/** When a rest of this many seconds, starting now, ends. */
const restUntil = (seconds: number) => Date.now() + seconds * 1000;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;

/** "W" for a warm-up, the working set's number, "D" for a drop set, "F" for a set to failure. */
function setLabel(sets: SetRow[], i: number) {
  const t = sets[i].setType;
  if (t === "warmup") return "W";
  if (t === "drop") return "D";
  if (t === "failure") return "F";
  return String(sets.slice(0, i + 1).filter((s) => s.setType === "working").length);
}

const nextType = (t: SetType, failureAllowed: boolean): SetType => {
  const order: SetType[] = failureAllowed ? ["warmup", "working", "drop", "failure"] : ["warmup", "working", "drop"];
  return order[(order.indexOf(t) + 1) % order.length];
};

/** Time since the workout started, ticking every second. */
function Elapsed({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt || now === null) return <span className="tabular-nums">0:00</span>;
  return <span className="tabular-nums">{clock(Math.floor((now - new Date(startedAt).getTime()) / 1000))}</span>;
}

/** The rest countdown at the bottom of the screen, started when a set is ticked. */
function RestTimer({ endsAt, onChange, onDone }: { endsAt: number; onChange: (endsAt: number) => void; onDone: () => void }) {
  const [left, setLeft] = useState(() => Math.ceil((endsAt - Date.now()) / 1000));
  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.ceil((endsAt - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        clearInterval(id);
        navigator.vibrate?.([200, 100, 200]);
        toast("Rest done. Next set.");
        onDone();
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, onDone]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 pt-3 pb-4 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <Timer className="size-5 text-primary-strong" aria-hidden />
        <span className="flex-1 font-display text-3xl tabular-nums" aria-live="polite" aria-label={`Rest, ${left} seconds left`}>
          {clock(left)}
        </span>
        <button type="button" className="h-10 rounded-lg border px-3 text-sm font-medium" onClick={() => onChange(endsAt - 15000)}>
          −15s
        </button>
        <button type="button" className="h-10 rounded-lg border px-3 text-sm font-medium" onClick={() => onChange(endsAt + 15000)}>
          +15s
        </button>
        <button type="button" className="h-10 rounded-lg bg-secondary px-3 text-sm font-medium" onClick={onDone}>
          Skip
        </button>
      </div>
    </div>
  );
}

const numberOrUndefined = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export function WorkoutLogger({
  sessionId,
  title,
  startedAt,
  unit,
  initial,
}: {
  sessionId: string;
  title: string;
  startedAt: string | null;
  unit: WeightUnit;
  initial: ExerciseBlock[];
}) {
  const [blocks, setBlocks] = useState(initial);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Sets beyond the plan's count were added during the workout and can be removed.
  const [plannedCounts] = useState(() => initial.map((b) => b.sets.length));

  const update = (b: number, i: number, patch: Partial<SetRow>) =>
    setBlocks((all) => all.map((block, bi) => (bi !== b ? block : { ...block, sets: block.sets.map((s, si) => (si === i ? { ...s, ...patch } : s)) })));

  const toggle = async (b: number, i: number) => {
    const block = blocks[b];
    const row = block.sets[i];
    if (row.done) {
      update(b, i, { done: false });
      const result = await unlogSet({ sessionId, exercise: block.name, setNumber: row.setNumber });
      if (!result.ok) {
        update(b, i, { done: true });
        toast(result.errors[0]);
      }
      return;
    }
    const reps = numberOrUndefined(row.reps);
    if (!reps) return toast("Enter the reps you did first.");
    update(b, i, { done: true });
    const result = await logSet({
      sessionId,
      exercise: block.name,
      setNumber: row.setNumber,
      setType: row.setType,
      plannedReps: row.plannedReps,
      plannedRpe: row.plannedRpe,
      weight: numberOrUndefined(row.weight),
      reps,
      rpe: numberOrUndefined(row.rpe),
    });
    if (!result.ok) {
      update(b, i, { done: false });
      return toast(result.errors[0]);
    }
    navigator.vibrate?.(30);
    setRestEndsAt(restUntil(row.setType === "warmup" ? WARMUP_REST_SECONDS : block.restSeconds));
  };

  const addSet = (b: number) =>
    setBlocks((all) =>
      all.map((block, bi) => {
        if (bi !== b) return block;
        const lastWorking = block.sets.findLast((s) => s.setType !== "warmup");
        const setNumber = Math.max(0, ...block.sets.map((s) => s.setNumber)) + 1;
        return {
          ...block,
          sets: [...block.sets, { setNumber, setType: "working", plannedReps: lastWorking?.plannedReps, plannedRpe: lastWorking?.plannedRpe, weight: lastWorking?.weight ?? "", reps: "", rpe: "", done: false }],
        };
      }),
    );

  const removeSet = (b: number, i: number) =>
    setBlocks((all) => all.map((block, bi) => (bi !== b ? block : { ...block, sets: block.sets.filter((_, si) => si !== i) })));

  const done = blocks.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0);
  const total = blocks.reduce((n, b) => n + b.sets.length, 0);

  return (
    <div className={cn("-mb-24 flex min-h-dvh flex-col pt-4", restEndsAt ? "pb-28" : "pb-10")}>
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-accent" aria-label="Back to Today (the workout keeps going)">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            <Elapsed startedAt={startedAt} /> · {done} of {total} sets
          </p>
        </div>
        <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setFinishing(true)}>
          Finish
        </Button>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        {blocks.map((block, b) => (
          <section key={block.name} aria-label={block.name} className="rounded-2xl border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{block.name}</h2>
              {block.isMainLift && <span className="shrink-0 text-xs font-medium text-primary-strong">Main lift</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Rest {block.restSeconds >= 120 ? `${Math.round(block.restSeconds / 60)} min` : `${block.restSeconds}s`}
              {block.failureAllowed && " · last set to failure is fine"}
            </p>

            <div className="mt-3 grid grid-cols-[1.75rem_minmax(0,1fr)_4rem_3rem_2.75rem_2.5rem] items-center gap-x-1.5 gap-y-2 text-xs text-muted-foreground">
              <span className="text-center">Set</span>
              <span>Last</span>
              <span className="text-center">{unit}</span>
              <span className="text-center">Reps</span>
              <span className="text-center">RPE</span>
              <span>
                <span className="sr-only">Done</span>
              </span>

              {block.sets.map((row, i) => (
                <SetRowInputs
                  key={row.setNumber}
                  label={setLabel(block.sets, i)}
                  row={row}
                  extra={i >= plannedCounts[b]}
                  onType={() => !row.done && update(b, i, { setType: nextType(row.setType, block.failureAllowed) })}
                  onChange={(patch) => update(b, i, patch)}
                  onToggle={() => toggle(b, i)}
                  onRemove={() => removeSet(b, i)}
                />
              ))}
            </div>
            <button type="button" onClick={() => addSet(b)} className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-medium">
              <Plus className="size-4" aria-hidden /> Add set
            </button>
          </section>
        ))}
      </div>

      {restEndsAt && <RestTimer key={restEndsAt} endsAt={restEndsAt} onChange={setRestEndsAt} onDone={() => setRestEndsAt(null)} />}
      <FinishSheet open={finishing} onOpenChange={setFinishing} sessionId={sessionId} setsDone={done} />
    </div>
  );
}

function SetRowInputs({
  label,
  row,
  extra,
  onType,
  onChange,
  onToggle,
  onRemove,
}: {
  label: string;
  row: SetRow;
  extra: boolean;
  onType: () => void;
  onChange: (patch: Partial<SetRow>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const input = "h-10 w-full rounded-lg border bg-background px-1 text-center text-base text-foreground tabular-nums disabled:opacity-100";
  const target = row.plannedReps ? `${row.plannedReps}${row.plannedRpe ? ` @ ${row.plannedRpe}` : ""}` : "";
  return (
    <>
      <button
        type="button"
        onClick={onType}
        aria-label={`Set type ${label}. Tap to change`}
        className={cn("grid h-10 place-items-center rounded-lg text-sm font-semibold", row.setType === "warmup" ? "text-muted-foreground" : "text-foreground", row.done ? "bg-easy/15" : "bg-secondary")}
      >
        {label}
      </button>
      <span className="min-w-0">
        {row.previous ? (
          <button type="button" disabled={row.done} onClick={() => onChange({ weight: row.previous!.weight, reps: String(row.previous!.reps) })} className="truncate text-left text-foreground/70 underline-offset-2 hover:underline" aria-label={`Use last time: ${row.previous.weight} ${"×"} ${row.previous.reps}`}>
            {row.previous.weight} × {row.previous.reps}
          </button>
        ) : (
          <span>{target || "–"}</span>
        )}
      </span>
      <input aria-label="Weight" inputMode="decimal" className={input} value={row.weight} disabled={row.done} onChange={(e) => onChange({ weight: e.target.value })} placeholder="–" />
      <input aria-label="Reps" inputMode="numeric" className={input} value={row.reps} disabled={row.done} onChange={(e) => onChange({ reps: e.target.value })} placeholder={row.plannedReps?.split("-")[0] ?? "–"} />
      <input aria-label="RPE (optional)" inputMode="decimal" className={input} value={row.rpe} disabled={row.done} onChange={(e) => onChange({ rpe: e.target.value })} placeholder={row.plannedRpe ? String(row.plannedRpe) : "–"} />
      {extra && !row.done ? (
        <button type="button" onClick={onRemove} aria-label="Remove this set" className="grid h-10 place-items-center rounded-lg text-muted-foreground hover:bg-accent">
          <X className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={row.done}
          aria-label={row.done ? "Set done. Tap to untick" : "Tick set done"}
          className={cn("grid h-10 place-items-center rounded-lg border transition-colors", row.done ? "border-easy bg-easy text-white" : "hover:bg-accent")}
        >
          <Check className="size-5" strokeWidth={3} />
        </button>
      )}
    </>
  );
}

function FinishSheet({ open, onOpenChange, sessionId, setsDone }: { open: boolean; onOpenChange: (o: boolean) => void; sessionId: string; setsDone: number }) {
  const [effort, setEffort] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; errors?: string[] }>) =>
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setErrors(result.errors ?? []);
    });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-8">
          <DrawerHeader className="px-0 text-left! md:text-left">
            <DrawerTitle className="text-2xl font-semibold">Finish workout</DrawerTitle>
            <DrawerDescription>{setsDone === 0 ? "No sets ticked yet." : `${plural(setsDone, "set")} done.`}</DrawerDescription>
          </DrawerHeader>
          <fieldset>
            <legend className="text-sm text-muted-foreground">
              How hard was it overall? {effort && <span className="font-medium text-foreground">{effort}/10, {EFFORT_LABEL[effort].toLowerCase()}</span>}
            </legend>
            <div className="mt-2 grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={effort === n}
                  onClick={() => setEffort(n)}
                  className={cn("h-10 rounded-lg border text-sm font-medium tabular-nums", effort === n ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent")}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-sm text-muted-foreground">
            Notes (optional)
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="mt-1.5" />
          </label>
          {errors.length > 0 && (
            <div className="mt-3">
              <Note tone="caution">{errors.join(" ")}</Note>
            </div>
          )}
          <Button
            className="mt-5 h-12 w-full rounded-xl text-base font-semibold"
            disabled={pending || !effort}
            onClick={() => run(() => finishWorkout({ sessionId, effort, notes: notes.trim() || undefined }))}
          >
            {pending ? <Loader2 className="animate-spin" /> : "Finish workout"}
          </Button>
          {confirmDiscard ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setConfirmDiscard(false)}>
                Keep it
              </Button>
              <Button className="h-11 rounded-xl bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={() => run(() => discardWorkout({ sessionId }))}>
                Discard
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDiscard(true)} className="mt-3 w-full py-2 text-sm text-destructive">
              Discard this workout
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
