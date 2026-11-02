// Sending recorded runs to Strava (SPEC decision 83): the parts that don't
// talk to Strava, so they can be tested. ede. only ever asks to upload
// ("activity:write") and never reads anything from Strava, so no Strava data
// can reach the AI coach.
import { z } from "zod";

/** The only permission ede. asks for. */
export const STRAVA_SCOPE = "activity:write";

export const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";

/** Where "Connect with Strava" sends the athlete to agree. */
export function authorizeUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", approval_prompt: "auto", scope: STRAVA_SCOPE, state });
  return `${STRAVA_AUTHORIZE_URL}?${params}`;
}

/** Whether the athlete left uploading ticked: they can untick it on Strava's screen. */
export function canUpload(scope: string | null | undefined): boolean {
  return !!scope && scope.split(/[\s,]+/).includes(STRAVA_SCOPE);
}

/** Refresh a little before Strava's six-hour access token runs out. */
export const needsRefresh = (expiresAt: Date, now: Date) => expiresAt.getTime() - now.getTime() < 10 * 60 * 1000;

/** What Strava sends back for a sign-in code or a refresh. Only what ede. keeps is checked. */
export const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().int().positive(),
  athlete: z.object({ id: z.union([z.number(), z.string()]) }).optional(),
});
export type TokenResponse = z.infer<typeof TokenResponse>;
