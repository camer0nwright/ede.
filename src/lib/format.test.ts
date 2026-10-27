import { describe, expect, it } from "vitest";
import { blockHeadline, formatDate, formatLongDate, formatMinutes, formatDayMinutes, formatDuration, formatMinutesShort, formatWeekRange, plural } from "./format";

describe("format", () => {
  it("writes a long date with the weekday", () => {
    expect(formatLongDate("2026-10-20")).toBe("Tuesday 20 October");
  });

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
    expect([45, 60, 90, 120, 180].map(formatMinutesShort)).toEqual(["45m", "1h", "1h30", "2h", "3h"]);
    expect([90, 120, 180].map((m) => formatDayMinutes(m))).toEqual(["1h30", "2h+", "2h+"]);
    expect([120, 300, 360].map((m) => formatDayMinutes(m, true))).toEqual(["2h", "5h", "6h+"]);
    expect(plural(1, "double day")).toBe("1 double day");
    expect(plural(2, "rest day")).toBe("2 rest days");
  });

  it("formats race times", () => {
    expect(formatDuration(1350)).toBe("22:30");
    expect(formatDuration(6600)).toBe("1:50:00");
  });
});

describe("training block headline", () => {
  const phases = ["base", "base", "base", "recovery", "build", "build", "build", "recovery"] as const;

  it("names this phase and the next different one, skipping recovery weeks", () => {
    expect(blockHeadline([...phases], 1).title).toBe("Base now. Build next.");
    expect(blockHeadline([...phases], 3).title).toBe("Base now. Build next.");
  });

  it("uses a recovery week as next only when nothing else follows", () => {
    expect(blockHeadline([...phases], 5).title).toBe("Build now. Recovery next.");
    expect(blockHeadline([...phases], 4).title).toBe("Recovery now. Build next.");
  });

  it("says how the plan ends", () => {
    expect(blockHeadline([...phases], 8).title).toBe("Recovery to the finish.");
    expect(blockHeadline(["build", "peak", "taper"], 3).title).toBe("Taper now. Race day next.");
  });

  it("describes the current phase and copes with weeks outside the plan", () => {
    expect(blockHeadline([...phases], 1).about).toMatch(/foundation/);
    expect(blockHeadline([...phases], 0).title).toBe("Base now. Build next.");
    expect(blockHeadline([...phases], 99).title).toBe("Recovery to the finish.");
  });
});
