"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, MapPin, Pause as PauseIcon, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { saveRecordedRun } from "@/app/(app)/session/actions";
import { Note } from "@/components/onboarding/choices";
import { EffortPicker } from "@/components/plan/check-in-sheet";
import { getRun, gpsState, setRun, startGps, stopGps, subscribe, type GpsState, type Recording } from "@/components/run/active-run";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canRecordRuns, openLocationSettings } from "@/lib/native-gps";
import { currentStep, formatClock, formatPace, summarise, type Pause } from "@/lib/run-track";
import { safely } from "@/lib/safely";
import { cn } from "@/lib/utils";
import type { RunView } from "@/lib/week-view";

const KM_PER_MILE = 1.609344;

/** For values that never change after the page loads. */
const noChange = () => () => {};

/** Pauses so far, with the one going now ending at `now`. */
const pausesTo = (r: Recording, now: number): Pause[] => (r.pausedAt ? [...r.pauses, { from: r.pausedAt, to: now }] : r.pauses);

/** Recording a planned run with GPS in the iPhone app (SPEC decision 82). */
export function RunRecorder({ session, unit, strava }: { session: RunView; unit: "km" | "mi"; strava: boolean }) {
  const id = session.id;
  const native = useSyncExternalStore(noChange, canRecordRuns, () => null);
  const rec = useSyncExternalStore(subscribe, () => getRun(id), () => null);
  const gps = useSyncExternalStore(subscribe, () => gpsState(id), () => "off" as const);
  const [now, setNow] = useState(() => Date.now());

  // Picks up a run that was going when the app closed. Leaving this screen
  // doesn't stop GPS: only finishing or discarding the run does.
  useEffect(() => {
    const saved = getRun(id);
    if (canRecordRuns() && saved && !saved.endedAt) startGps(id);
  }, [id]);

  // Ticks the clock. Keyed on whether the run is going, not on the run itself,
  // which changes with every GPS point and would keep restarting the timer.
  const going = !!rec && !rec.endedAt;
  useEffect(() => {
    if (!going) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [going]);

  if (native === null) return null;

  const start = () => {
    setNow(Date.now());
    setRun(id, { startedAt: Date.now(), points: [], pauses: [] });
    startGps(id);
  };
  const pause = () => rec && setRun(id, { ...rec, pausedAt: Date.now() });
  const resume = () => rec?.pausedAt && setRun(id, { ...rec, pauses: pausesTo(rec, Date.now()), pausedAt: undefined });
  const finish = () => {
    if (!rec) return;
    const t = Date.now();
    void stopGps();
    setRun(id, { ...rec, pauses: pausesTo(rec, t), pausedAt: undefined, endedAt: t });
  };
  const discard = () => {
    void stopGps();
    setRun(id, null);
  };

  const header = (
    <header className="flex items-center justify-between pt-4">
      <Link href="/" className="-ml-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-label={rec ? "Back to Today (the run keeps recording)" : "Back to Today"}>
        <ChevronLeft className="size-5" /> Today
      </Link>
      {rec && !rec.endedAt && <GpsStatus gps={gps} />}
    </header>
  );

  if (rec?.endedAt) return <FinishRun session={session} unit={unit} strava={strava} rec={rec} header={header} onDiscard={discard} onSaved={() => setRun(id, null)} />;

  // While paused, the pause runs on with no end yet, so no GPS that comes in now counts.
  const live = rec ? summarise(rec.points, rec.startedAt, now, pausesTo(rec, Infinity)) : null;
  const step = live ? currentStep(session.steps, live.movingSeconds) : null;
  const shown = step ?? (live ? null : { index: 0, secondsLeft: session.steps[0] ? session.steps[0].minutes * 60 : 0 });

  return (
    <main className="-mb-24 flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-col pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {header}
      <p className="label-eyebrow mt-6 text-run">{rec ? (rec.pausedAt ? "Paused" : "Recording") : session.roleLabel}</p>
      <h1 className="mt-2 text-4xl font-medium tracking-tight">{session.title}</h1>
      {!rec && (
        <p className="mt-1 text-muted-foreground">
          {session.minutes} min{session.distance ? ` · ${session.distance}` : ""}
        </p>
      )}

      {rec && live && (
        <section aria-label="Your run" className="mt-8 grid grid-cols-2 gap-px overflow-hidden border bg-border">
          <Stat label="Time" value={formatClock(live.movingSeconds)} wide />
          <Stat label={unit === "mi" ? "Miles" : "Kilometres"} value={(unit === "mi" ? live.distanceKm / KM_PER_MILE : live.distanceKm).toFixed(2)} />
          <Stat label={`Pace /${unit}`} value={formatPace(live.paceSecondsPerKm, unit)} />
        </section>
      )}

      {session.steps.length > 0 && (
        <ol className="mt-6 flex flex-col gap-2" aria-label="Your plan for this run">
          {session.steps.map((s, i) => {
            const current = shown?.index === i;
            const done = !!live && (step ? i < step.index : true);
            return (
              <li key={i} className={cn("flex items-center justify-between gap-3 border px-4 py-3", current ? "border-foreground bg-card" : "bg-card/50", done && "opacity-50")}>
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.pace ? `${s.pace} · ` : ""}
                    {s.paceName}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{current && rec ? `${formatClock(shown!.secondsLeft)} left` : `${s.minutes} min`}</span>
              </li>
            );
          })}
          {live && !step && <li className="border bg-card px-4 py-3 text-sm font-medium">Plan done. Finish when you&apos;re ready.</li>}
        </ol>
      )}

      {gps === "denied" && (
        <div className="mt-6 flex flex-col gap-2">
          <Note tone="caution">ede. needs your location to record runs. Allow it in Settings: Location, then &quot;While Using the App&quot;.</Note>
          <Button variant="secondary" className="h-11 rounded-md" onClick={() => void openLocationSettings()}>
            Open Settings
          </Button>
        </div>
      )}
      {!native && (
        <div className="mt-6">
          <Note>Recording runs needs the ede. iPhone app. You can still mark this run done from Today.</Note>
        </div>
      )}

      <div className="mt-auto pt-8">
        {!rec ? (
          <Button className="h-14 w-full rounded-md text-base font-semibold" onClick={start} disabled={!native}>
            <Play className="size-5" /> Start run
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {rec.pausedAt ? (
              <Button className="h-14 rounded-md text-base font-semibold" onClick={resume}>
                <Play className="size-5" /> Resume
              </Button>
            ) : (
              <Button variant="secondary" className="h-14 rounded-md text-base font-semibold" onClick={pause}>
                <PauseIcon className="size-5" /> Pause
              </Button>
            )}
            <Button variant={rec.pausedAt ? "secondary" : "default"} className="h-14 rounded-md text-base font-semibold" onClick={finish}>
              <Square className="size-4" /> Finish
            </Button>
          </div>
        )}
        {!rec && native && <p className="mt-3 text-center text-xs text-muted-foreground">Keeps recording with your phone locked. Your route is only shown to you.</p>}
      </div>
    </main>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("bg-card px-4 py-4", wide && "col-span-2")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading font-medium tracking-tight tabular-nums", wide ? "text-6xl" : "text-3xl")}>{value}</p>
    </div>
  );
}

function GpsStatus({ gps }: { gps: GpsState }) {
  const text = gps === "ok" ? "GPS" : gps === "searching" ? "Finding GPS…" : gps === "denied" ? "No location" : gps === "unavailable" ? "GPS lost" : "";
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", gps === "ok" ? "text-easy" : "text-muted-foreground")}>
      <MapPin className="size-3.5" aria-hidden /> {text}
    </span>
  );
}

function FinishRun({
  session,
  unit,
  strava,
  rec,
  header,
  onDiscard,
  onSaved,
}: {
  session: RunView;
  unit: "km" | "mi";
  /** Strava is connected: offer to send the run there (SPEC decision 84). */
  strava: boolean;
  rec: Recording;
  header: React.ReactNode;
  onDiscard: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [effort, setEffort] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [sendToStrava, setSendToStrava] = useState(strava);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = summarise(rec.points, rec.startedAt, rec.endedAt!, rec.pauses);

  const save = () =>
    startTransition(async () => {
      setErrors([]);
      const result = await safely(() =>
        saveRecordedRun({ date: session.date, slot: session.slot, startedAt: rec.startedAt, endedAt: rec.endedAt, points: rec.points, pauses: rec.pauses, effort, notes: notes.trim() || undefined, sendToStrava: strava && sendToStrava }),
      );
      if (!result.ok) return setErrors(result.errors);
      onSaved();
      toast(result.caution ?? "Run saved. Nice work.");
      router.push("/");
    });

  return (
    <main className="-mb-24 flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-col gap-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {header}
      <div>
        <p className="label-eyebrow text-run">Run finished</p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight">{session.title}</h1>
      </div>
      <section aria-label="Your run" className="grid grid-cols-3 gap-px overflow-hidden border bg-border">
        <Stat label="Time" value={formatClock(run.movingSeconds)} />
        <Stat label={unit === "mi" ? "Miles" : "Km"} value={(unit === "mi" ? run.distanceKm / KM_PER_MILE : run.distanceKm).toFixed(2)} />
        <Stat label={`Pace /${unit}`} value={formatPace(run.paceSecondsPerKm, unit)} />
      </section>
      <EffortPicker effort={effort} onChange={setEffort} />
      <label className="text-sm text-muted-foreground">
        Notes (optional)
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Legs felt heavy on the hills" className="mt-1.5" />
      </label>
      {strava && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={sendToStrava} onChange={(e) => setSendToStrava(e.target.checked)} className="size-5 shrink-0 accent-primary-strong" />
          Send to Strava (your notes and effort stay in ede.)
        </label>
      )}
      {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
      <div className="mt-auto flex flex-col gap-2">
        <Button className="h-14 rounded-md text-base font-semibold" onClick={save} disabled={pending || !effort}>
          {pending ? <Loader2 className="animate-spin" /> : "Save run"}
        </Button>
        {confirmDiscard ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-12 rounded-md" onClick={() => setConfirmDiscard(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" className="h-12 rounded-md" onClick={onDiscard} disabled={pending}>
              Delete this run
            </Button>
          </div>
        ) : (
          <button type="button" className="h-11 text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setConfirmDiscard(true)} disabled={pending}>
            Discard run
          </button>
        )}
      </div>
    </main>
  );
}
