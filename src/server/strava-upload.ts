// Sending a recorded run to Strava (SPEC decision 84): the GPX file goes up
// as a new activity, then Strava is asked a few times whether it's ready.
// Runs after the run is saved, so saving never waits on Strava. Server only.
import "server-only";
import { db } from "@/lib/db";
import { Pause, TrackPoint } from "@/lib/run-track";
import { externalId, readUploadReply, routeToGpx, type StravaStatus, type UploadReply } from "@/lib/strava-upload";
import { z } from "zod";
import { stravaAccessToken } from "./strava";

const UPLOADS_URL = "https://www.strava.com/api/v3/uploads";
/** Strava usually takes under two seconds; it asks to be checked no more than once a second. */
const CHECKS = 6;
const CHECK_EVERY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setStatus(sessionId: string, status: StravaStatus, extra: { stravaUploadId?: string | null; stravaActivityId?: string | null } = {}) {
  await db.runLog.update({ where: { sessionId }, data: { stravaStatus: status, ...extra } });
}

async function call(token: string, init: RequestInit & { url: string }): Promise<UploadReply> {
  try {
    const res = await fetch(init.url, { ...init, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401) return { state: "failed", reason: "Strava didn't accept ede.'s access." };
    if (res.status === 429) return { state: "failed", reason: "Strava is busy." };
    return readUploadReply(await res.json().catch(() => null));
  } catch (e) {
    console.error("Strava upload request failed", e);
    return { state: "failed", reason: "Strava couldn't be reached." };
  }
}

/** Waits for Strava to finish with an upload. Leaves it as "sending" if Strava is still busy. */
async function follow(sessionId: string, token: string, reply: UploadReply): Promise<StravaStatus> {
  for (let i = 0; reply.state === "processing" && i < CHECKS; i++) {
    await sleep(CHECK_EVERY_MS);
    reply = await call(token, { url: `${UPLOADS_URL}/${reply.uploadId}`, method: "GET" });
  }
  if (reply.state === "done") {
    await setStatus(sessionId, "sent", { stravaActivityId: reply.activityId });
    return "sent";
  }
  if (reply.state === "failed") {
    console.error(`Sending a run to Strava failed: ${reply.reason}`);
    await setStatus(sessionId, "failed");
    return "failed";
  }
  return "sending";
}

const Route = z.array(TrackPoint);
const Pauses = z.array(Pause);

/** Sends a recorded run to Strava. Does nothing if Strava isn't connected or the run has no route. */
export async function sendRunToStrava(athleteId: string, sessionId: string): Promise<StravaStatus | null> {
  const session = await db.session.findFirst({
    where: { id: sessionId, week: { athleteId } },
    select: { title: true, runLog: { select: { route: true, pauses: true, recorded: true, stravaStatus: true } } },
  });
  const log = session?.runLog;
  if (!session || !log?.recorded || !log.route || log.stravaStatus === "sent") return log?.stravaStatus === "sent" ? "sent" : null;

  const route = Route.safeParse(JSON.parse(log.route));
  const pauses = Pauses.safeParse(log.pauses ? JSON.parse(log.pauses) : []);
  if (!route.success || route.data.length < 2) return null;

  const token = await stravaAccessToken(athleteId);
  if (!token) return null;
  await setStatus(sessionId, "sending", { stravaUploadId: null, stravaActivityId: null });

  const form = new FormData();
  const name = `${session.title} · ede.`;
  form.append("file", new Blob([routeToGpx(route.data, pauses.success ? pauses.data : [], name)], { type: "application/gpx+xml" }), "run.gpx");
  form.append("data_type", "gpx");
  form.append("sport_type", "Run");
  form.append("name", name);
  form.append("external_id", externalId(sessionId, route.data[0].t));

  const reply = await call(token, { url: UPLOADS_URL, method: "POST", body: form });
  if (reply.state === "processing") await setStatus(sessionId, "sending", { stravaUploadId: reply.uploadId });
  return follow(sessionId, token, reply);
}

/** Asks Strava again about a run still sending (when the athlete looks at it). */
export async function checkStravaUpload(athleteId: string, sessionId: string): Promise<StravaStatus | null> {
  const log = await db.runLog.findFirst({ where: { sessionId, session: { week: { athleteId } } }, select: { stravaStatus: true, stravaUploadId: true } });
  if (!log || log.stravaStatus !== "sending") return (log?.stravaStatus as StravaStatus | null) ?? null;
  // Stopped before Strava took the file: it can be sent again.
  if (!log.stravaUploadId) {
    await setStatus(sessionId, "failed");
    return "failed";
  }
  const token = await stravaAccessToken(athleteId);
  if (!token) return "sending";
  return follow(sessionId, token, { state: "processing", uploadId: log.stravaUploadId });
}
