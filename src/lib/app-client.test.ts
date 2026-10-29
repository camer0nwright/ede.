import { describe, expect, it } from "vitest";
import { isApp } from "./app-client";

// The iPhone app's welcome screen (SPEC decision 81).

describe("telling the iPhone app from a browser", () => {
  it("spots the app's user agent", () => {
    expect(isApp("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ede-app")).toBe(true);
  });

  it("treats every browser as the website", () => {
    expect(isApp("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isApp("ede-application/1.0")).toBe(false);
    expect(isApp(null)).toBe(false);
  });
});
