import { describe, expect, it } from "vitest";
import { externalId, readUploadReply, routeToGpx, stravaActivityUrl } from "./strava-upload";
import type { TrackPoint } from "./run-track";

// Sending recorded runs to Strava (SPEC decision 84).

const START = Date.UTC(2026, 10, 2, 7, 0, 0);
const point = (i: number, t = START + i * 2000): TrackPoint => ({ lat: 51.5 + i * 0.0001, lng: -0.12, t, acc: 5, alt: 12 });

describe("the GPX file", () => {
  it("has every point with its time and height", () => {
    const gpx = routeToGpx([point(0), point(1), point(2)], [], "Easy run");
    expect(gpx.match(/<trkpt /g)).toHaveLength(3);
    expect(gpx).toContain('<trkpt lat="51.500100" lon="-0.120000"><ele>12.0</ele><time>2026-11-02T07:00:02.000Z</time></trkpt>');
    expect(gpx).toContain("<name>Easy run</name>");
    expect(gpx.match(/<trkseg>/g)).toHaveLength(1);
  });

  it("starts a new segment after each pause", () => {
    const pause = { from: START + 5000, to: START + 60_000 };
    const gpx = routeToGpx([point(0), point(1), point(2), point(3, START + 61_000), point(4, START + 63_000)], [pause], "Easy run");
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
  });

  it("leaves out heights it doesn't have, and makes names safe", () => {
    const gpx = routeToGpx([{ ...point(0), alt: undefined }], [], "Hills & <strides>");
    expect(gpx).not.toContain("<ele>");
    expect(gpx).toContain("<name>Hills &amp; &lt;strides&gt;</name>");
  });
});

describe("Strava's replies", () => {
  it("waits while Strava is still working on it", () => {
    expect(readUploadReply({ id: 1, id_str: "16486788", error: null, status: "Your activity is still being processed.", activity_id: null })).toEqual({
      state: "processing",
      uploadId: "16486788",
    });
  });

  it("is done once Strava names the activity", () => {
    expect(readUploadReply({ id_str: "16486788", error: null, activity_id: 9876543210 })).toEqual({ state: "done", activityId: "9876543210" });
  });

  it("counts a duplicate as done, linking the run that's already there", () => {
    const reply = { id_str: "1", activity_id: null, error: "abc.gpx duplicate of <a href='/activities/12345' target='_blank'>Morning Run</a>" };
    expect(readUploadReply(reply)).toEqual({ state: "done", activityId: "12345" });
  });

  it("fails with a plain reason, without Strava's HTML", () => {
    expect(readUploadReply({ id_str: "1", activity_id: null, error: "Time information is <b>missing</b>" })).toEqual({ state: "failed", reason: "Time information is missing" });
    expect(readUploadReply(null).state).toBe("failed");
  });

  it("gives each run its own upload id, and links to the activity", () => {
    expect(externalId("s1", START)).toBe(`ede-s1-${START}.gpx`);
    expect(stravaActivityUrl("42")).toBe("https://www.strava.com/activities/42");
  });
});
