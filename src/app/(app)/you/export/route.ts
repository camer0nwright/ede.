// "Download my data" (SPEC decision 57): everything ede. holds about the
// signed-in athlete, as one JSON file. Secrets (the password hash and sign-in
// tokens) are left out; everything else is included as stored.
import { db } from "@/lib/db";
import { sessionAthleteId } from "@/server/auth";

/** Stored JSON text becomes real JSON in the download, so it reads cleanly. */
function parsed(text: string | null) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function GET() {
  const athleteId = await sessionAthleteId();
  if (!athleteId) return new Response("Log in to download your data.", { status: 401 });

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    omit: { passwordHash: true, pendingTokenHash: true },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" }, omit: { athleteId: true } },
      injuries: { orderBy: { startedAt: "asc" }, omit: { athleteId: true } },
      outlines: { orderBy: { createdAt: "asc" }, omit: { athleteId: true } },
      weeks: {
        orderBy: { weekStart: "asc" },
        omit: { athleteId: true },
        include: {
          sessions: {
            orderBy: [{ date: "asc" }, { slot: "asc" }],
            omit: { weekId: true },
            include: {
              runLog: { omit: { sessionId: true } },
              setLogs: { orderBy: { setNumber: "asc" }, omit: { sessionId: true, exerciseId: true }, include: { exercise: { select: { name: true } } } },
            },
          },
        },
      },
      coachMessages: { orderBy: { createdAt: "asc" }, omit: { athleteId: true } },
      authSessions: { select: { createdAt: true, expiresAt: true } },
    },
  });
  if (!athlete) return new Response("Log in to download your data.", { status: 401 });

  const { authSessions, outlines, weeks, ...rest } = athlete;
  const data = {
    exportedAt: new Date().toISOString(),
    note: "Everything ede. holds about you. Weights are in kg and distances in km, whatever units you see in the app.",
    athlete: rest,
    signedInDevices: authSessions,
    planOutlines: outlines.map((o) => ({ ...o, input: parsed(o.input), outline: parsed(o.outline) })),
    weeks: weeks.map((w) => ({
      ...w,
      quality: parsed(w.quality),
      dayNotes: parsed(w.dayNotes),
      sessions: w.sessions.map(({ setLogs, ...s }) => ({
        ...s,
        steps: parsed(s.steps),
        exercises: parsed(s.exercises),
        setLogs: setLogs.map(({ exercise, ...l }) => ({ exercise: exercise.name, ...l })),
      })),
    })),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ede-data-${data.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
