// The Strava connection (SPEC decision 83): swapping the sign-in code for
// tokens, keeping them encrypted, refreshing them and disconnecting. Off
// unless STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_TOKEN_KEY are all
// set. Server only: the client secret and tokens never reach the browser.
import "server-only";
import { db } from "@/lib/db";
import { needsRefresh, TokenResponse } from "@/lib/strava";
import { appUrl } from "./email";
import { keyFrom, open, seal } from "./secret-box";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const REVOKE_URL = "https://www.strava.com/oauth/revoke";

/** Holds the random state while the athlete is on Strava's screen. */
export const STRAVA_STATE_COOKIE = "ede_strava_state";

function config() {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  const key = keyFrom(process.env.STRAVA_TOKEN_KEY);
  return clientId && clientSecret && key ? { clientId, clientSecret, key } : null;
}

/** Whether Strava is set up on this server, so "Connect with Strava" can be offered. */
export const stravaAvailable = () => config() !== null;

export const stravaClientId = () => config()?.clientId ?? null;

/** Where Strava sends the athlete back to. Never taken from the request (see appUrl). */
export const stravaRedirectUri = () => `${appUrl()}/api/strava/callback`;

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Strava token request failed: ${res.status}`);
      return null;
    }
    const parsed = TokenResponse.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch (e) {
    console.error("Strava token request failed", e);
    return null;
  }
}

/** Swaps the code from Strava's sign-in for tokens and keeps them. False if it didn't work. */
export async function connectStrava(athleteId: string, code: string, scope: string): Promise<boolean> {
  const cfg = config();
  const tokens = await tokenRequest({ code, grant_type: "authorization_code" });
  if (!cfg || !tokens?.athlete) return false;
  const data = {
    stravaAthleteId: String(tokens.athlete.id),
    scope,
    accessToken: seal(cfg.key, tokens.access_token),
    refreshToken: seal(cfg.key, tokens.refresh_token),
    expiresAt: new Date(tokens.expires_at * 1000),
  };
  await db.stravaLink.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
  return true;
}

/** Whether this athlete has connected Strava. */
export async function stravaConnected(athleteId: string): Promise<boolean> {
  return (await db.stravaLink.count({ where: { athleteId } })) > 0;
}

/**
 * A working access token for uploading, refreshed if it's about to run out.
 * Null if Strava isn't connected, or the athlete has removed ede. on Strava
 * (the connection is then forgotten, so they can connect again).
 */
export async function stravaAccessToken(athleteId: string): Promise<string | null> {
  const cfg = config();
  const link = await db.stravaLink.findUnique({ where: { athleteId } });
  if (!cfg || !link) return null;
  if (!needsRefresh(link.expiresAt, new Date())) return open(cfg.key, link.accessToken);

  const refreshToken = open(cfg.key, link.refreshToken);
  const tokens = refreshToken ? await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }) : null;
  if (!tokens) {
    if (!refreshToken) await db.stravaLink.delete({ where: { athleteId } }).catch(() => {});
    return null;
  }
  // Strava may send a new refresh token; the old one stops working at once, so it's saved straight away.
  await db.stravaLink.update({
    where: { athleteId },
    data: { accessToken: seal(cfg.key, tokens.access_token), refreshToken: seal(cfg.key, tokens.refresh_token), expiresAt: new Date(tokens.expires_at * 1000) },
  });
  return tokens.access_token;
}

/** Disconnects Strava: tells Strava to cancel ede.'s access, then forgets the tokens either way. */
export async function disconnectStrava(athleteId: string): Promise<void> {
  const cfg = config();
  const link = await db.stravaLink.findUnique({ where: { athleteId } });
  if (!link) return;
  const token = cfg && open(cfg.key, link.refreshToken);
  if (cfg && token) {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(10_000),
    }).catch((e) => console.error("Cancelling Strava access failed", e));
  }
  await db.stravaLink.delete({ where: { athleteId } }).catch(() => {});
}
