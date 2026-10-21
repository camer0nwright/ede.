import { describe, expect, it } from "vitest";
import { RESET_LINK_MINUTES, resetEmail, resetLinkProblem } from "./password-reset";

const now = new Date("2026-10-21T12:00:00Z");
const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000);

describe("reset links", () => {
  it("works when unused and in time", () => {
    expect(resetLinkProblem({ expiresAt: inMinutes(30), usedAt: null }, now)).toBeNull();
  });

  it("refuses an unknown link", () => {
    expect(resetLinkProblem(null, now)).toMatch(/isn't valid/);
  });

  it("works only once", () => {
    expect(resetLinkProblem({ expiresAt: inMinutes(30), usedAt: inMinutes(-5) }, now)).toMatch(/already been used/);
  });

  it("expires", () => {
    expect(resetLinkProblem({ expiresAt: inMinutes(-1), usedAt: null }, now)).toMatch(/expired/);
    expect(resetLinkProblem({ expiresAt: now, usedAt: null }, now)).toMatch(/expired/);
  });
});

describe("reset email", () => {
  const link = "https://trainwithede.com/reset-password?token=abc";

  it("carries the link and says how long it lasts", () => {
    const email = resetEmail(link, "Cam");
    expect(email.subject).toBe("Reset your ede. password");
    expect(email.text).toContain(link);
    expect(email.text).toContain("Hi Cam,");
    expect(email.text).toContain(`${RESET_LINK_MINUTES} minutes`);
    expect(email.html).toContain(`href="${link}"`);
  });

  it("greets without a name", () => {
    expect(resetEmail(link, null).text.startsWith("Hi,")).toBe(true);
  });

  it("escapes the name in the HTML", () => {
    expect(resetEmail(link, "<b>Cam</b>").html).toContain("Hi &lt;b&gt;Cam&lt;/b&gt;,");
  });
});
