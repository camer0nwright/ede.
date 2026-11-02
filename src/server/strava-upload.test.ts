import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sending a recorded run to Strava (SPEC decision 84), against a stand-in
// Strava and database.

const runLog = { route: "", pauses: "[]", recorded: true, stravaStatus: null as string | null, stravaUploadId: null as string | null };
const updates: Record<string, unknown>[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    session: { findFirst: vi.fn(async () => ({ title: "Easy run", runLog: { ...runLog } })) },
    runLog: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(runLog, data);
      }),
      findFirst: vi.fn(async () => ({ stravaStatus: runLog.stravaStatus, stravaUploadId: runLog.stravaUploadId })),
    },
  },
}));
const token = vi.fn(async (): Promise<string | null> => "access-token");
vi.mock("./strava", () => ({ stravaAccessToken: () => token() }));

const { checkStravaUpload, sendRunToStrava } = await import("./strava-upload");

const START = Date.UTC(2026, 10, 2, 7, 0, 0);
const route = Array.from({ length: 5 }, (_, i) => ({ lat: 51.5 + i * 0.0001, lng: -0.12, t: START + i * 2000, acc: 5 }));

/** Strava's replies, one per request, in order. */
function strava(...replies: { status?: number; body: unknown }[]) {
  const calls: { url: string; method: string; body?: FormData }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body as FormData });
      const r = replies.shift() ?? { body: {} };
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    }),
  );
  return calls;
}

/** Runs the upload, moving the clock on through its waits. */
async function send() {
  const result = sendRunToStrava("athlete", "session");
  await vi.runAllTimersAsync();
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(runLog, { route: JSON.stringify(route), pauses: "[]", recorded: true, stravaStatus: null, stravaUploadId: null });
  updates.length = 0;
  token.mockResolvedValue("access-token");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sending a run to Strava", () => {
  it("uploads the route as a run, waits for Strava, and keeps the activity", async () => {
    const calls = strava({ status: 201, body: { id_str: "77", activity_id: null, error: null } }, { body: { id_str: "77", activity_id: 555, error: null } });
    expect(await send()).toBe("sent");

    expect(calls[0]).toMatchObject({ url: "https://www.strava.com/api/v3/uploads", method: "POST" });
    const form = calls[0].body!;
    expect(form.get("data_type")).toBe("gpx");
    expect(form.get("sport_type")).toBe("Run");
    expect(form.get("name")).toBe("Easy run · ede.");
    expect(form.get("external_id")).toBe(`ede-session-${START}.gpx`);
    expect(await (form.get("file") as Blob).text()).toContain("<trkpt");
    expect(calls[1]).toMatchObject({ url: "https://www.strava.com/api/v3/uploads/77", method: "GET" });
    expect(runLog).toMatchObject({ stravaStatus: "sent", stravaActivityId: "555" });
  });

  it("never sends notes or effort", async () => {
    const calls = strava({ status: 201, body: { id_str: "1", activity_id: 2, error: null } });
    await send();
    expect([...calls[0].body!.keys()].sort()).toEqual(["data_type", "external_id", "file", "name", "sport_type"]);
  });

  it("links the run that's already there when Strava says it's a duplicate", async () => {
    strava({ status: 201, body: { id_str: "1", activity_id: null, error: null } }, { body: { id_str: "1", activity_id: null, error: "duplicate of <a href='/activities/999'>Run</a>" } });
    expect(await send()).toBe("sent");
    expect(runLog).toMatchObject({ stravaStatus: "sent", stravaActivityId: "999" });
  });

  it("marks it failed when Strava turns it down, so it can be sent again", async () => {
    strava({ status: 400, body: { id_str: "1", activity_id: null, error: "Malformed file" } });
    expect(await send()).toBe("failed");
    expect(runLog.stravaStatus).toBe("failed");
  });

  it("leaves it sending when Strava is slow, and finishes it on a later check", async () => {
    const busy = { body: { id_str: "77", activity_id: null, error: null } };
    strava({ status: 201, ...busy }, busy, busy, busy, busy, busy, busy);
    expect(await send()).toBe("sending");
    expect(runLog).toMatchObject({ stravaStatus: "sending", stravaUploadId: "77" });

    strava({ body: { id_str: "77", activity_id: 555, error: null } });
    const later = checkStravaUpload("athlete", "session");
    await vi.runAllTimersAsync();
    expect(await later).toBe("sent");
  });

  it("does nothing without Strava connected, or for a run sent already", async () => {
    const calls = strava();
    token.mockResolvedValue(null);
    expect(await send()).toBeNull();
    runLog.stravaStatus = "sent";
    expect(await send()).toBe("sent");
    expect(calls).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
