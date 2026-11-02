// Strava sends the athlete back here after "Connect with Strava" (SPEC
// decision 83), with a code to swap for tokens, or an error if they said no.
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { canUpload } from "@/lib/strava";
import { sessionAthleteId } from "@/server/auth";
import { connectStrava, STRAVA_STATE_COOKIE } from "@/server/strava";

const sameState = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const expected = jar.get(STRAVA_STATE_COOKIE)?.value;
  jar.delete({ name: STRAVA_STATE_COOKIE, path: "/api/strava" });

  const athleteId = await sessionAthleteId();
  if (!athleteId) redirect("/login");
  const state = params.get("state") ?? "";
  if (!expected || !sameState(state, expected)) redirect("/you?strava=failed#strava");

  const code = params.get("code");
  const scope = params.get("scope");
  if (params.get("error") || !code) redirect("/you?strava=cancelled#strava");
  if (!canUpload(scope)) redirect("/you?strava=no-upload#strava");

  const ok = await connectStrava(athleteId, code, scope!);
  redirect(ok ? "/you?strava=connected#strava" : "/you?strava=failed#strava");
}
