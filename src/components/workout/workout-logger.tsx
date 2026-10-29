"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronLeft, Dumbbell, Loader2, MoreHorizontal, Play, Plus, Search, Timer, Trash2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { addExercise, answerSwap, discardWorkout, finishWorkout, logSet, removeExercise, swapExercise, unlogSet } from "@/app/(flow)/workout/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EFFORT_LABEL } from "@/lib/checkin";
import { plural } from "@/lib/format";
import type { BodyArea, Equipment, SetType } from "@/lib/domain";
import { embedUrl, formVideo } from "@/lib/form-videos";
import { addOptions, swapOptions } from "@/lib/progression";
import { cn } from "@/lib/utils";
import { effortWords, type ExerciseBlock, type SetRow, type WeightUnit } from "@/lib/workout";
import { safely } from "@/lib/safely";

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
    <div className="fixed inset-x-0 bottom-0 z-40 bg-panel px-4 pt-3 pb-4 text-panel-foreground pb-safe">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <span className="flex flex-1 flex-col">
          <span className="label-eyebrow flex items-center gap-1.5 text-primary">
            <Timer className="size-3.5" aria-hidden /> Rest
          </span>
          <span className="font-display text-4xl font-semibold tabular-nums" aria-live="polite" aria-label={`Rest, ${left} seconds left`}>
            {clock(left)}
          </span>
        </span>
        <button type="button" className="h-10 rounded-md bg-white/10 px-3 text-sm font-medium hover:bg-white/15" onClick={() => onChange(endsAt - 15000)}>
          −15s
        </button>
        <button type="button" className="h-10 rounded-md bg-white/10 px-3 text-sm font-medium hover:bg-white/15" onClick={() => onChange(endsAt + 15000)}>
          +15s
        </button>
        <button type="button" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" onClick={onDone}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** The exercise's effort target in words, from its working sets. */
const blockEffort = (block: ExerciseBlock) => {
  const working = block.sets.find((s) => s.setType === "working");
  return effortWords(working?.plannedRpe ?? 9, working?.plannedReps, block.name);
};

const numberOrUndefined = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export function WorkoutLogger({
  sessionId,
  title,
  startedAt,
  unit,
  initial,
  equipment,
  avoid,
}: {
  sessionId: string;
  title: string;
  startedAt: string | null;
  unit: WeightUnit;
  initial: ExerciseBlock[];
  equipment: Equipment[];
  avoid?: BodyArea;
}) {
  const [blocks, setBlocks] = useState(initial);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Sets beyond the plan's count were added during the workout and can be removed.
  const [plannedCounts, setPlannedCounts] = useState(() => initial.map((b) => b.sets.length));
  const [menu, setMenu] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  /** After a swap: "Use X instead of Y from now on?" (SPEC decision 77). */
  const [keepPrompt, setKeepPrompt] = useState<{ from: string; to: string } | null>(null);

  /** Puts a block from the server in place (a swap) or at the end (an add). */
  const placeBlock = (block: ExerciseBlock, at?: number) => {
    if (at === undefined) {
      setBlocks((all) => [...all, block]);
      setPlannedCounts((counts) => [...counts, block.sets.length]);
    } else {
      setBlocks((all) => all.map((x, i) => (i === at ? block : x)));
      setPlannedCounts((counts) => counts.map((c, i) => (i === at ? block.sets.length : c)));
    }
  };
  const dropBlock = (at: number) => {
    setBlocks((all) => all.filter((_, i) => i !== at));
    setPlannedCounts((counts) => counts.filter((_, i) => i !== at));
  };

  const update = (b: number, i: number, patch: Partial<SetRow>) =>
    setBlocks((all) => all.map((block, bi) => (bi !== b ? block : { ...block, sets: block.sets.map((s, si) => (si === i ? { ...s, ...patch } : s)) })));

  const toggle = async (b: number, i: number) => {
    const block = blocks[b];
    const row = block.sets[i];
    if (row.done) {
      update(b, i, { done: false });
      const result = await safely(() => unlogSet({ sessionId, exercise: block.name, setNumber: row.setNumber }));
      if (!result.ok) {
        update(b, i, { done: true });
        toast(result.errors[0]);
      }
      return;
    }
    const reps = numberOrUndefined(row.reps);
    if (!reps) return toast("Enter the reps you did first.");
    update(b, i, { done: true });
    const result = await safely(() => logSet({
      sessionId,
      exercise: block.name,
      setNumber: row.setNumber,
      setType: row.setType,
      plannedReps: row.plannedReps,
      plannedRpe: row.plannedRpe,
      weight: numberOrUndefined(row.weight),
      reps,
      rpe: numberOrUndefined(row.rpe),
    }));
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
      <header className="sticky top-[env(safe-area-inset-top)] z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2 py-2">
          <Link href="/" className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-accent" aria-label="Back to Today (the workout keeps going)">
            <ChevronLeft className="size-5" />
          </Link>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground tabular-nums">
            <Elapsed startedAt={startedAt} /> · {done} of {total} sets
          </p>
          <Button className="h-10 rounded-md px-5 font-semibold" onClick={() => setFinishing(true)}>
            Finish
          </Button>
        </div>
        <div className="-mx-4 h-0.5 bg-border" aria-hidden>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      <div className="mt-6">
        <p className="label-eyebrow flex items-center gap-1.5 text-strength">
          <Dumbbell className="size-3.5" aria-hidden /> Gym · In progress
        </p>
        <h1 className="mt-2 text-4xl font-medium tracking-tighter">{title}</h1>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {blocks.map((block, b) => (
          <section key={block.name} aria-label={block.name} className="border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {block.isMainLift && <p className="label-eyebrow mb-1.5 text-primary-strong">Main lift</p>}
                <h2 className="text-2xl leading-tight font-medium">{block.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{blockEffort(block)}</span> · rest{" "}
                  {block.restSeconds >= 120 ? `${Math.round(block.restSeconds / 60)} min` : `${block.restSeconds}s`}
                </p>
              </div>
              <button type="button" onClick={() => setMenu(b)} aria-label={`More for ${block.name}`} className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full hover:bg-accent">
                <MoreHorizontal className="size-5" />
              </button>
            </div>
            <FormVideo key={block.name} name={block.name} />
            {keepPrompt?.to === block.name && <KeepSwap {...keepPrompt} onDone={() => setKeepPrompt(null)} />}
            {block.suggestion && (
              <p className="mt-3 border-l-2 border-primary-strong bg-secondary px-3 py-2 text-xs">
                <TrendingUp className="mr-1 inline size-3.5 align-[-2px] text-primary-strong" aria-hidden />
                {block.suggestion.note}
              </p>
            )}

            <div className="mt-4 grid grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_3.5rem_2.5rem] items-center gap-x-1.5 gap-y-2 text-[11px] text-muted-foreground">
              <span className="text-center">Set</span>
              <span>Last</span>
              <span className="text-center">{unit}</span>
              <span className="text-center">Reps</span>
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
            <button type="button" onClick={() => addSet(b)} className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-secondary text-sm font-medium hover:bg-accent">
              <Plus className="size-4" aria-hidden /> Add set
            </button>
          </section>
        ))}
      </div>

      <button type="button" onClick={() => setAdding(true)} className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/25 text-sm font-medium hover:bg-accent">
        <Plus className="size-4" aria-hidden /> Add exercise
      </button>

      {menu !== null && blocks[menu] && (
        <ExerciseMenu
          sessionId={sessionId}
          block={blocks[menu]}
          others={blocks.map((x) => x.name)}
          equipment={equipment}
          avoid={avoid}
          onClose={() => setMenu(null)}
          onSwapped={(block, askToKeep) => {
            const from = blocks[menu].name;
            placeBlock(block, menu);
            setKeepPrompt(askToKeep ? { from, to: block.name } : null);
          }}
          onRemoved={() => dropBlock(menu)}
        />
      )}
      <AddExercise
        open={adding}
        onOpenChange={setAdding}
        sessionId={sessionId}
        present={blocks.map((x) => x.name)}
        equipment={equipment}
        avoid={avoid}
        onAdded={(block) => placeBlock(block)}
      />
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
  const input = "h-10 w-full rounded-md border bg-background px-1 text-center text-base text-foreground tabular-nums disabled:border-transparent disabled:bg-transparent disabled:opacity-100";
  const target = row.plannedReps ? `${row.plannedReps} reps` : "";
  return (
    <>
      <button
        type="button"
        onClick={onType}
        aria-label={`Set type ${label}. Tap to change`}
        className={cn("grid h-10 place-items-center rounded-md text-sm font-semibold", row.setType === "warmup" ? "text-muted-foreground" : "text-foreground", row.done ? "bg-primary/30" : "bg-secondary")}
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
      <input aria-label="Reps" inputMode="numeric" className={input} value={row.reps} disabled={row.done} onChange={(e) => onChange({ reps: e.target.value })} placeholder={row.targetReps ? String(row.targetReps) : (row.plannedReps?.split("-")[0] ?? "–")} />
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
          className={cn("grid h-10 place-items-center rounded-md border transition-colors", row.done ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
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
      const result = await safely(() => action());
      if (result && !result.ok) setErrors(result.errors ?? []);
    });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-8">
          <DrawerHeader className="px-0 text-left! md:text-left">
            <DrawerTitle className="text-[28px] leading-tight font-medium tracking-tight">Finish workout</DrawerTitle>
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

/** Asks once whether a swap should carry on into future sessions. */
function KeepSwap({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const answer = (keep: boolean) =>
    startTransition(async () => {
      const result = await safely(() => answerSwap({ from, to, keep }));
      if (!result.ok) return void toast(result.errors[0]);
      if (keep) toast(`Future sessions will use ${to}. You can undo this in You.`);
      onDone();
    });
  return (
    <div className="mt-3 border bg-muted p-3 text-sm">
      <p>
        Use <span className="font-medium">{to}</span> instead of <span className="font-medium">{from}</span> from now on?
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" className="h-9 flex-1 rounded-md" disabled={pending} onClick={() => answer(true)}>
          Yes, from now on
        </Button>
        <Button size="sm" variant="outline" className="h-9 flex-1 rounded-md" disabled={pending} onClick={() => answer(false)}>
          Just today
        </Button>
      </div>
    </div>
  );
}

/** A "Watch form" button that loads the exercise's video in place, only once tapped. */
function FormVideo({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const id = formVideo(name);
  if (!id) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-strong hover:underline"
      >
        {open ? <X className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {open ? "Hide video" : "Watch form"}
      </button>
      {open && (
        <iframe
          src={embedUrl(id)}
          title={`${name} form video`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="mt-2 aspect-video w-full border bg-muted"
        />
      )}
    </div>
  );
}

/** An exercise's menu: swap it for an alternative, or remove it (only before any of its sets are logged). */
function ExerciseMenu({
  sessionId,
  block,
  others,
  equipment,
  avoid,
  onClose,
  onSwapped,
  onRemoved,
}: {
  sessionId: string;
  block: ExerciseBlock;
  others: string[];
  equipment: Equipment[];
  avoid?: BodyArea;
  onClose: () => void;
  onSwapped: (block: ExerciseBlock, askToKeep: boolean) => void;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const logged = block.sets.some((s) => s.done);
  const options = swapOptions(block.name, equipment, avoid, others);
  const run = (action: () => ReturnType<typeof swapExercise>, done: (block?: ExerciseBlock, askToKeep?: boolean) => void, message: string) =>
    startTransition(async () => {
      const result = await safely(() => action());
      if (!result.ok) return void toast(result.errors[0]);
      done(result.block, result.askToKeep);
      toast(message);
      onClose();
    });

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
          <DrawerHeader className="px-0 text-left! md:text-left">
            <DrawerTitle className="text-[28px] leading-tight font-medium tracking-tight">{block.name}</DrawerTitle>
            <DrawerDescription>{logged ? "Untick its sets to swap or remove it." : "Swap it for another exercise, or remove it from today."}</DrawerDescription>
          </DrawerHeader>
          {!logged && (
            <>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ArrowLeftRight className="size-4" aria-hidden /> Swap for
              </h3>
              {options.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No alternatives suit your equipment.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {options.slice(0, 8).map((e) => (
                    <li key={e.name}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => swapExercise({ sessionId, from: block.name, to: e.name }), (b, ask) => b && onSwapped(b, !!ask), `Swapped to ${e.name}.`)}
                        className="flex w-full items-center justify-between gap-3 border bg-card px-4 py-3 text-left hover:bg-accent disabled:opacity-50"
                      >
                        <span className="font-medium">{e.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{e.equipment}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeExercise({ sessionId, name: block.name }), () => onRemoved(), `${block.name} removed.`)}
                className="mt-5 flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-destructive"
              >
                <Trash2 className="size-4" aria-hidden /> Remove from today
              </button>
            </>
          )}
          {pending && <Loader2 className="mx-auto mt-3 size-5 animate-spin text-muted-foreground" aria-label="Saving" />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Search the exercise library (filtered to the athlete's equipment) and add one to the workout. */
function AddExercise({
  open,
  onOpenChange,
  sessionId,
  present,
  equipment,
  avoid,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string;
  present: string[];
  equipment: Equipment[];
  avoid?: BodyArea;
  onAdded: (block: ExerciseBlock) => void;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const results = addOptions(query, equipment, avoid, present).slice(0, 30);
  const add = (name: string) =>
    startTransition(async () => {
      const result = await safely(() => addExercise({ sessionId, name }));
      if (!result.ok || !result.block) return void toast(result.ok ? "Something went wrong." : result.errors[0]);
      onAdded(result.block);
      toast(`${name} added.`);
      setQuery("");
      onOpenChange(false);
    });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="mx-auto flex w-full max-w-md flex-col overflow-hidden px-4 pb-8">
          <DrawerHeader className="px-0 text-left! md:text-left">
            <DrawerTitle className="text-[28px] leading-tight font-medium tracking-tight">Add exercise</DrawerTitle>
            <DrawerDescription>From the exercise library, matched to your equipment.</DrawerDescription>
          </DrawerHeader>
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, e.g. curl or shoulders" aria-label="Search exercises" className="h-11 pl-9" />
          </label>
          <ul className="mt-3 flex flex-col gap-1.5 overflow-y-auto">
            {results.length === 0 && <li className="py-3 text-center text-sm text-muted-foreground">No exercises match.</li>}
            {results.map((e) => (
              <li key={e.name}>
                <button type="button" disabled={pending} onClick={() => add(e.name)} className="flex w-full items-center justify-between gap-3 border bg-card px-4 py-3 text-left hover:bg-accent disabled:opacity-50">
                  <span>
                    <span className="block font-medium">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{e.muscleGroup}</span>
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{e.equipment}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
