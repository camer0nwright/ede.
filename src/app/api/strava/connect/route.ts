// "Connect with Strava" (SPEC decision 83): sends the signed-in athlete to
// Strava to agree to ede. uploading their runs. A random state, kept in a
// short-lived cookie, makes sure the answer that comes back started here.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeUrl } from "@/lib/strava";
import { sessionAthleteId } from "@/server/auth";
import { STRAVA_STATE_COOKIE, stravaClientId, stravaRedirectUri } from "@/server/strava";

export async function GET() {
  if (!(await sessionAthleteId())) redirect("/login");
  const clientId = stravaClientId();
  if (!clientId) redirect("/you");

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STRAVA_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/api/strava",
  });
  redirect(authorizeUrl({ clientId, redirectUri: stravaRedirectUri(), state }));
}
