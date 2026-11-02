// Sending a recorded run to Strava (SPEC decision 84): the GPX file and
// reading Strava's replies. Plain code, so it can be tested; the upload itself
// is in src/server/strava-upload.ts.
import type { Pause, TrackPoint } from "./run-track";

/** Where a run is with Strava. Null: never sent. */
export type StravaStatus = "sending" | "sent" | "failed";

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/**
 * The route as a GPX file, with a new track segment after each pause, so
 * the time spent paused isn't run through as one long straight line.
 */
export function routeToGpx(points: TrackPoint[], pauses: Pause[], name: string): string {
  const segments: TrackPoint[][] = [];
  let current: TrackPoint[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && pauses.some((x) => prev.t < x.to && p.t >= x.from)) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);

  const trkpt = (p: TrackPoint) =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ""}<time>${new Date(p.t).toISOString()}</time></trkpt>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="ede." xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><time>${new Date(points[0]?.t ?? 0).toISOString()}</time></metadata>`,
    `  <trk><name>${escapeXml(name)}</name><type>running</type>`,
    ...segments.map((seg) => ["    <trkseg>", ...seg.map(trkpt), "    </trkseg>"].join("\n")),
    "  </trk>",
    "</gpx>",
    "",
  ].join("\n");
}

/** What a reply from Strava's upload endpoints means for the run. */
export type UploadReply =
  | { state: "processing"; uploadId: string }
  | { state: "done"; activityId: string }
  | { state: "failed"; reason: string };

/**
 * Reads an upload reply. A duplicate (the run is already on Strava, say from
 * a watch) counts as done when Strava names the activity it matches.
 */
export function readUploadReply(body: unknown): UploadReply {
  const b = (body ?? {}) as { id_str?: unknown; id?: unknown; activity_id?: unknown; error?: unknown };
  const activityId = b.activity_id != null ? String(b.activity_id) : null;
  const error = typeof b.error === "string" && b.error ? b.error : null;
  if (error) {
    const duplicate = /duplicate/i.test(error) && error.match(/activities\/(\d+)/);
    return duplicate ? { state: "done", activityId: duplicate[1] } : { state: "failed", reason: error.replace(/<[^>]*>/g, "").slice(0, 200) };
  }
  if (activityId) return { state: "done", activityId };
  const uploadId = typeof b.id_str === "string" ? b.id_str : b.id != null ? String(b.id) : null;
  return uploadId ? { state: "processing", uploadId } : { state: "failed", reason: "Strava sent back something unexpected." };
}

/** A unique id for the upload, so sending the same run twice is caught by Strava as a duplicate. */
export const externalId = (sessionId: string, startedAt: number) => `ede-${sessionId}-${startedAt}.gpx`;

export const stravaActivityUrl = (activityId: string) => `https://www.strava.com/activities/${activityId}`;
