import { describe, expect, it } from "vitest";
import { authorizeUrl, canUpload, needsRefresh, TokenResponse } from "./strava";

// Connecting Strava (SPEC decision 83).

describe("connecting Strava", () => {
  it("asks only to upload activities, and comes back to ede.", () => {
    const url = new URL(authorizeUrl({ clientId: "123", redirectUri: "https://trainwithede.com/api/strava/callback", state: "abc" }));
    expect(url.origin + url.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("activity:write");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://trainwithede.com/api/strava/callback");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("only counts as connected if uploading was left ticked", () => {
    expect(canUpload("read,activity:write")).toBe(true);
    expect(canUpload("activity:write")).toBe(true);
    expect(canUpload("read")).toBe(false);
    expect(canUpload("activity:write_all")).toBe(false);
    expect(canUpload(null)).toBe(false);
  });

  it("refreshes the access token when it has under ten minutes left", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(needsRefresh(new Date("2026-11-02T12:05:00Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-11-02T11:00:00Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-11-02T14:00:00Z"), now)).toBe(false);
  });

  it("checks what Strava sends back", () => {
    expect(TokenResponse.safeParse({ access_token: "a", refresh_token: "r", expires_at: 1793650000, athlete: { id: 42 } }).success).toBe(true);
    expect(TokenResponse.safeParse({ access_token: "a", expires_at: 1793650000 }).success).toBe(false);
  });
});
