import { describe, expect, it } from "vitest";
import { formatDate, formatMinutes, formatMinutesShort, formatWeekRange, plural } from "./format";

describe("format", () => {
  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(90)).toBe("1h 30");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(65)).toBe("1h 05");
  });

  it("formats week ranges within and across months", () => {
    expect(formatWeekRange("2026-10-12")).toBe("12–18 Oct");
    expect(formatWeekRange("2026-10-26")).toBe("26 Oct – 1 Nov");
  });

  it("formats dates", () => {
    expect(formatDate("2027-03-14")).toBe("14 Mar 2027");
  });

  it("formats short minutes and plurals", () => {
    expect([45, 60, 90, 120, 180].map(formatMinutesShort)).toEqual(["45m", "1h", "1h30", "2h+", "2h+"]);
    expect(plural(1, "double day")).toBe("1 double day");
    expect(plural(2, "rest day")).toBe("2 rest days");
  });
});
