// Loading what's been done for the history page: logged sets and finished
// runs from the database, plus recent sessions. Server only.
import "server-only";
import { SKIP_REASONS, type SkipReason } from "@/lib/checkin";
import { db } from "@/lib/db";
import { fromDbDate } from "@/lib/db-mapping";
import { SetType } from "@/lib/domain";
import type { LiftSet, RunDone } from "@/lib/history";

export type RecentSession = {
  id: string;
  date: string;
  type: "run" | "strength";
  title: string;
  status: "completed" | "skipped";
  minutes: number | null;
  effort: number | null;
  distanceKm: number | null;
  skipReason?: SkipReason;
  sets: number;
};

export async function loadHistory(athleteId: string) {
  const sessions = await db.session.findMany({
    where: { week: { athleteId }, status: { in: ["completed", "skipped"] } },
    include: { runLog: true, setLogs: { include: { exercise: { select: { name: true } } } } },
    orderBy: [{ date: "desc" }, { slot: "desc" }],
  });

  const sets: LiftSet[] = sessions
    .filter((s) => s.status === "completed")
    .flatMap((s) =>
      s.setLogs.map((l) => ({
        date: fromDbDate(s.date),
        sessionId: s.id,
        exercise: l.exercise.name,
        setType: SetType.catch("working").parse(l.setType),
        weightKg: l.weightKg,
        reps: l.reps,
      })),
    );
  const runs: RunDone[] = sessions
    .filter((s) => s.status === "completed" && s.type === "run" && s.actualMinutes)
    .map((s) => ({ date: fromDbDate(s.date), minutes: s.actualMinutes!, ...(s.runLog?.distanceKm && { distanceKm: s.runLog.distanceKm }) }));
  const recent: RecentSession[] = sessions.slice(0, 20).map((s) => ({
    id: s.id,
    date: fromDbDate(s.date),
    type: s.type === "run" ? "run" : "strength",
    title: s.title,
    status: s.status === "skipped" ? "skipped" : "completed",
    minutes: s.actualMinutes,
    effort: s.effort,
    distanceKm: s.runLog?.distanceKm ?? null,
    ...(s.status === "skipped" && { skipReason: SKIP_REASONS.find((r) => r === s.skipReason) ?? "other" }),
    sets: s.setLogs.length,
  }));
  return { sets, runs, recent };
}
