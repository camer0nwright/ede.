"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkIn, undoCheckIn } from "@/app/session/actions";
import { startWorkout } from "@/app/workout/actions";
import { Chip, Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EFFORT_LABEL, SKIP_LABEL, SKIP_REASONS, type CheckIn, type SkipReason } from "@/lib/checkin";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SessionView } from "@/lib/week-view";

/** What the session sheet needs to offer check-ins. */
export type CheckInOptions = { canCheckIn: boolean; today: string; unit: "km" | "mi" };

const KM_PER_MILE = 1.609344;

/** One line about a check-in: "Done · 42 min · effort 6" or "Skipped · Ill". */
export function checkInSummary(c: CheckIn, unit: "km" | "mi" = "km"): string {
  if (c.status === "skipped") return `Skipped · ${SKIP_LABEL[c.skipReason]}`;
  const distance = c.distanceKm ? ` · ${(unit === "mi" ? c.distanceKm / KM_PER_MILE : c.distanceKm).toFixed(1)} ${unit === "mi" ? "mi" : "km"}` : "";
  return `Done · ${formatMinutes(c.actualMinutes)}${distance} · effort ${c.effort}/10`;
}

/** "Start workout" for a gym session (logging set by set), or "Resume workout" if one is going. */
export function WorkoutButton({ session, className }: { session: SessionView; className?: string }) {
  const [pending, startTransition] = useTransition();
  if (session.type !== "strength") return null;
  const base = cn("flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.99]", className);
  if (session.workout?.inProgress) {
    return (
      <Link href={`/workout/${session.workout.id}`} className={base}>
        Resume workout
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={base}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startWorkout({ date: session.date, slot: session.slot });
          if (result && !result.ok) toast(result.errors[0]);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : "Start workout"}
    </button>
  );
}

/** The buttons at the bottom of a session sheet, and the done/skip forms they open. */
export function CheckInPanel({ session, options, onClose }: { session: SessionView; options: CheckInOptions; onClose: () => void }) {
  const [mode, setMode] = useState<"buttons" | "done" | "skip">("buttons");

  if (!options.canCheckIn) {
    return (
      <Link href="/onboarding" className="mt-6 grid h-12 place-items-center rounded-xl border font-medium hover:bg-accent">
        Set up your own plan to check in
      </Link>
    );
  }
  if (session.type === "strength" && session.workout?.inProgress) return <WorkoutButton session={session} className="mt-6" />;
  if (session.checkIn) return <CheckedIn session={session} unit={options.unit} onClose={onClose} />;
  if (mode === "done") return <DoneForm session={session} unit={options.unit} onBack={() => setMode("buttons")} onClose={onClose} />;
  if (mode === "skip") return <SkipForm session={session} onBack={() => setMode("buttons")} onClose={onClose} />;

  const canComplete = session.date <= options.today;
  const lift = session.type === "strength";
  return (
    <div className="mt-6 grid grid-cols-2 gap-2">
      {lift && canComplete && <WorkoutButton session={session} className="col-span-2" />}
      <button type="button" className="h-12 rounded-xl border font-medium hover:bg-accent" onClick={() => setMode("skip")}>
        Skip
      </button>
      <button
        type="button"
        disabled={!canComplete}
        title={canComplete ? undefined : "You can mark it done on the day"}
        className={cn(
          "h-12 rounded-xl font-semibold disabled:opacity-40",
          lift ? "border font-medium hover:bg-accent" : "bg-primary text-primary-foreground",
        )}
        onClick={() => setMode("done")}
      >
        {lift ? "Mark done without logging" : "Mark done"}
      </button>
      {!canComplete && <p className="col-span-2 text-center text-xs text-muted-foreground">You can mark it done on the day.</p>}
    </div>
  );
}

function useSave(onSaved: (caution: string | null) => void) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const save = (action: () => ReturnType<typeof checkIn>) => {
    setErrors([]);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setErrors(result.errors);
      router.refresh();
      onSaved(result.caution);
    });
  };
  return { save, errors, pending };
}

function Errors({ errors }: { errors: string[] }) {
  return errors.length > 0 ? <Note tone="caution">{errors.join(" ")}</Note> : null;
}

/** After saving: a caution about the notes stays on screen; otherwise the sheet closes. */
function afterSave(caution: string | null, message: string, setCaution: (c: string) => void, onClose: () => void) {
  if (caution) return setCaution(caution);
  toast(message);
  onClose();
}

function CautionStep({ caution, onClose }: { caution: string; onClose: () => void }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Note tone="caution">{caution}</Note>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12 rounded-xl" onClick={onClose}>
          Close
        </Button>
        <Button asChild className="h-12 rounded-xl">
          <Link href="/you/injury">Report an injury</Link>
        </Button>
      </div>
    </div>
  );
}

function DoneForm({ session, unit, onBack, onClose }: { session: SessionView; unit: "km" | "mi"; onBack: () => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(String(session.minutes));
  const [distance, setDistance] = useState("");
  const [effort, setEffort] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [caution, setCaution] = useState<string | null>(null);
  const { save, errors, pending } = useSave((c) => afterSave(c, "Session done. Nice work.", setCaution, onClose));

  if (caution) return <CautionStep caution={caution} onClose={onClose} />;
  return (
    <form
      className="mt-6 flex flex-col gap-5 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          checkIn({
            date: session.date,
            slot: session.slot,
            status: "completed",
            actualMinutes: Number(minutes),
            effort,
            ...(session.type === "run" && distance && { distance: Number(distance) }),
            notes: notes.trim() || undefined,
          }),
        );
      }}
    >
      <h3 className="font-semibold">How did it go?</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted-foreground">
          Time (minutes)
          <Input type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1.5 h-11" required />
        </label>
        {session.type === "run" && (
          <label className="text-sm text-muted-foreground">
            Distance ({unit === "mi" ? "miles" : "km"}, optional)
            <Input type="number" inputMode="decimal" step="0.01" min={0} max={500} value={distance} onChange={(e) => setDistance(e.target.value)} className="mt-1.5 h-11" />
          </label>
        )}
      </div>
      <fieldset>
        <legend className="text-sm text-muted-foreground">
          Effort {effort ? <span className="font-medium text-foreground">· {effort}/10, {EFFORT_LABEL[effort].toLowerCase()}</span> : "(1 easy, 10 all out)"}
        </legend>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={effort === n}
              aria-label={`Effort ${n}, ${EFFORT_LABEL[n]}`}
              onClick={() => setEffort(n)}
              className={cn(
                "h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors",
                effort === n ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="text-sm text-muted-foreground">
        Notes (optional)
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Legs felt heavy on the hills" className="mt-1.5" />
      </label>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="h-12 rounded-xl" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="submit" className="h-12 rounded-xl font-semibold" disabled={pending || !effort || !Number(minutes)}>
          {pending ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}

function SkipForm({ session, onBack, onClose }: { session: SessionView; onBack: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<SkipReason | undefined>();
  const [notes, setNotes] = useState("");
  const [caution, setCaution] = useState<string | null>(null);
  const { save, errors, pending } = useSave((c) =>
    // Skipping for an injury: the plan can only adapt once it knows what hurts.
    afterSave(c ?? (reason === "injury" ? "Report what hurts so ede. can adapt your plan around it." : null), "Session skipped.", setCaution, onClose),
  );

  if (caution) return <CautionStep caution={caution} onClose={onClose} />;
  return (
    <form
      className="mt-6 flex flex-col gap-5 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason) save(() => checkIn({ date: session.date, slot: session.slot, status: "skipped", skipReason: reason, notes: notes.trim() || undefined }));
      }}
    >
      <h3 className="font-semibold">Why are you skipping it?</h3>
      <div className="flex flex-wrap gap-2">
        {SKIP_REASONS.map((r) => (
          <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
            {SKIP_LABEL[r]}
          </Chip>
        ))}
      </div>
      <label className="text-sm text-muted-foreground">
        Notes (optional)
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="mt-1.5" />
      </label>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="h-12 rounded-xl" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="submit" className="h-12 rounded-xl font-semibold" disabled={pending || !reason}>
          {pending ? <Loader2 className="animate-spin" /> : "Skip session"}
        </Button>
      </div>
    </form>
  );
}

function CheckedIn({ session, unit, onClose }: { session: SessionView; unit: "km" | "mi"; onClose: () => void }) {
  const c = session.checkIn!;
  const { save, errors, pending } = useSave(() => {
    toast("Check-in undone.");
    onClose();
  });
  return (
    <div className="mt-6 flex flex-col gap-3 border-t pt-5">
      <p className="flex items-center gap-2 font-medium">
        {c.status === "completed" && <Check className="size-4 text-easy" aria-hidden />}
        {checkInSummary(c, unit)}
      </p>
      {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
      {session.type === "strength" && session.workout && (
        <Link href={`/workout/${session.workout.id}`} className="grid h-12 place-items-center rounded-xl border font-medium hover:bg-accent">
          View workout
        </Link>
      )}
      <Errors errors={errors} />
      <Button variant="secondary" className="h-12 rounded-xl" onClick={() => save(() => undoCheckIn({ date: session.date, slot: session.slot }))} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : c.status === "completed" ? "Undo, not done yet" : "Undo skip"}
      </Button>
    </div>
  );
}
