import { describe, expect, it } from "vitest";
import { CheckInInput, checkInCaution, progressSummary, sessionKey } from "./checkin";

describe("check-ins", () => {
  it("accepts a completed session with time and effort, and a skip with a reason", () => {
    expect(CheckInInput.safeParse({ date: "2026-10-13", slot: 1, status: "completed", actualMinutes: 42, effort: 6, distance: 7.5 }).success).toBe(true);
    expect(CheckInInput.safeParse({ date: "2026-10-13", slot: 2, status: "skipped", skipReason: "illness" }).success).toBe(true);
  });

  it("refuses a done session without time, an effort outside 1-10, or a skip without a reason", () => {
    expect(CheckInInput.safeParse({ date: "2026-10-13", slot: 1, status: "completed", effort: 6 }).success).toBe(false);
    expect(CheckInInput.safeParse({ date: "2026-10-13", slot: 1, status: "completed", actualMinutes: 30, effort: 11 }).success).toBe(false);
    expect(CheckInInput.safeParse({ date: "2026-10-13", slot: 1, status: "skipped" }).success).toBe(false);
  });

  it("is cautious about what people write", () => {
    expect(checkInCaution("felt dizzy at the end")).toMatch(/doctor/);
    expect(checkInCaution("knee pain on the hills")).toMatch(/report it as an injury/);
    expect(checkInCaution("felt great")).toBeNull();
  });

  it("counts sessions done out of those due so far", () => {
    const keys = [sessionKey("2026-10-12", 1), sessionKey("2026-10-13", 1), sessionKey("2026-10-13", 2)];
    const summary = progressSummary(keys, {
      [keys[0]]: { status: "completed", actualMinutes: 40, effort: 5 },
      [keys[1]]: { status: "skipped", skipReason: "work_life" },
    });
    expect(summary).toEqual({ due: 3, done: 1, skipped: 1 });
  });
});
