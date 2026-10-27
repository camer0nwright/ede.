import { describe, expect, it } from "vitest";
import { scrubReport, scrubText, stripQuery } from "./sentry-scrub";

describe("error report scrubbing", () => {
  it("drops query strings, so reset tokens never leave", () => {
    expect(stripQuery("https://trainwithede.com/reset-password?token=abc123")).toBe("https://trainwithede.com/reset-password");
    expect(stripQuery("https://trainwithede.com/plan#week")).toBe("https://trainwithede.com/plan");
    expect(stripQuery("/you")).toBe("/you");
  });

  it("blanks emails and secret-looking values in text", () => {
    expect(scrubText("No account for cam@example.com")).toBe("No account for [email]");
    expect(scrubText('failed {"password":"hunter22","name":"Cam"}')).toBe('failed {"password":[removed],"name":"Cam"}');
    expect(scrubText("token=abc123&x=1")).toBe("token=[removed]&x=1");
    expect(scrubText("Cannot read properties of undefined")).toBe("Cannot read properties of undefined");
  });

  it("removes who, cookies, form contents and headers except the browser", () => {
    const event = scrubReport({
      user: { email: "cam@example.com" },
      extra: { anything: 1 },
      request: {
        url: "https://trainwithede.com/reset-password?token=abc",
        query_string: "token=abc",
        cookies: { ede_session: "x" },
        data: { password: "hunter22" },
        headers: { "user-agent": "Safari", cookie: "ede_session=x", "x-forwarded-for": "1.2.3.4" },
      },
      exception: { values: [{ value: "Bad email cam@example.com" }] },
    });
    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.request).toEqual({ url: "https://trainwithede.com/reset-password", headers: { "user-agent": "Safari" } });
    expect(event.exception?.values?.[0].value).toBe("Bad email [email]");
  });

  it("drops console breadcrumbs and strips URLs from the rest", () => {
    const event = scrubReport({
      breadcrumbs: [
        { category: "console", message: "logged cam@example.com" },
        { category: "navigation", data: { from: "/login", to: "/reset-password?token=abc" } },
        { category: "fetch", data: { url: "/you/export?x=1", method: "GET" } },
      ],
    });
    expect(event.breadcrumbs).toEqual([
      { category: "navigation", data: { from: "/login", to: "/reset-password" } },
      { category: "fetch", data: { url: "/you/export", method: "GET" } },
    ]);
  });
});
