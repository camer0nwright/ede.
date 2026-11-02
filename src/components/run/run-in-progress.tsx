"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { runHref, savedRuns, startGps, subscribe } from "@/components/run/active-run";
import { canRecordRuns } from "@/lib/native-gps";

// One string, so the snapshot stays the same between renders when nothing changed.
const snapshot = () => savedRuns().map((r) => `${r.id}:${r.finished ? 1 : 0}`).join(",");

/** On Today: a way back to a run that's recording, or finished and not yet saved (SPEC decision 82). */
export function RunInProgress() {
  const runs = useSyncExternalStore(subscribe, snapshot, () => "");

  // Reopening the app mid-run: GPS picks up again here, without opening the run.
  useEffect(() => {
    if (!canRecordRuns()) return;
    for (const r of savedRuns()) if (!r.finished) return startGps(r.id);
  }, []);

  if (!runs) return null;
  const [id, finished] = runs.split(",")[0].split(":");
  return (
    <Link href={runHref(id)} className="flex items-center gap-3 border border-run/40 bg-card px-4 py-3 active:scale-[0.99]">
      <MapPin className="size-5 shrink-0 text-run" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{finished === "1" ? "Your run isn't saved yet" : "You have a run going"}</span>
        <span className="block text-sm text-muted-foreground">{finished === "1" ? "Pick how it felt and save it." : "Tap to see your time, distance and pace."}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
