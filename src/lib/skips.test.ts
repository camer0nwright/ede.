import { describe, expect, it } from "vitest";
import { ALL_RULES, runMinutes, totalMinutes, type PastWeek } from "@/server/plan-checker/rules";
import { build } from "@/test/injured-plan";
import { PROFILES } from "@/test/profiles";
import { sessionKey, type CheckIn } from "./checkin";
import { buildPlanOutline } from "./plan-outline";
import { rebuildOutline } from "./plan-rebuild";
import { easeAfterSkips, easeBackOffer, easeBackStart, reviewWeek } from "./skips";
import { buildPlanWeeks } from "./week-builder";

const input = PROFILES["half marathon, intermediate"];
const weeks = buildPlanWeeks(buildPlanOutline(input), build(input)).map((b) => b.week);
const week = weeks[3]; // a build week with quality runs
const hardRuns = week.sessions.filter((s) => s.type === "run" && s.intensity !== "easy");

const skip = (s: { date: string; slot: number }, reason: "illness" | "fatigue" | "work_life" | "holiday"): Record<string, CheckIn> => ({
  [sessionKey(s.date, s.slot)]: { status: "skipped", skipReason: reason },
});

describe("easing after a skip", () => {
  it("makes the next two sessions after an illness skip easier, with a note", () => {
    const first = week.sessions[0];
    const checkIns = skip(first, "illness");
    const [eased] = easeAfterSkips([week], checkIns, first.date);
    const next = eased.sessions.filter((s) => s.date > first.date).slice(0, 2);
    expect(next.every((s) => s.type !== "run" || s.intensity === "easy")).toBe(true);
    expect(eased.dayNotes[next[0].date]).toMatch(/ill/);
    // Sessions after the next two are as planned.
    expect(eased.sessions.slice(3)).toEqual(week.sessions.slice(3));
  });

  it("eases hard runs into easy ones of the same length, and the week still passes the checker", () => {
    expect(hardRuns.length).toBeGreaterThan(0);
    const was = hardRuns[0];
    // Skip the last session on an earlier day, so the hard run is the next one.
    const before = week.sessions.filter((s) => s.date < was.date).at(-1)!;
    expect(before).toBeDefined();
    const [eased] = easeAfterSkips([week], skip(before, "fatigue"), before.date);
    const now = eased.sessions.find((s) => s.date === was.date && s.slot === was.slot)!;
    expect(now).toMatchObject({ intensity: "easy", plannedMinutes: was.plannedMinutes });
    const ctx = { availability: input.availability, history: [], experienceLevel: input.experienceLevel, strengthVolume: input.strengthVolume };
    const placement = ALL_RULES.flatMap((r) => r(eased, ctx)).filter((v) => !["run-progression", "recovery-week", "session-variety"].includes(v.rule));
    expect(placement).toEqual([]);
  });

  it("leaves the plan alone after a work or holiday skip, or an old illness", () => {
    const first = week.sessions[0];
    expect(easeAfterSkips([week], skip(first, "work_life"), first.date)).toEqual([week]);
    expect(easeAfterSkips([week], skip(first, "illness"), "2027-01-01")).toEqual([week]);
  });

  it("doesn't change sessions already checked in", () => {
    const [first, second] = week.sessions;
    const checkIns = { ...skip(first, "illness"), [sessionKey(second.date, second.slot)]: { status: "completed", actualMinutes: 30, effort: 5 } as CheckIn };
    const [eased] = easeAfterSkips([week], checkIns, first.date);
    expect(eased.sessions[1]).toEqual(week.sessions[1]);
  });
});

describe("easing back in after a missed week", () => {
  const runs = week.sessions.filter((s) => s.type === "run");

  it("offers it when most of the running was missed, saying why", () => {
    const ill = Object.fromEntries(runs.map((r) => [sessionKey(r.date, r.slot), { status: "skipped", skipReason: "illness" } as CheckIn]));
    const review = reviewWeek(week, ill);
    expect(review).toMatchObject({ doneRunMinutes: 0, skipped: expect.arrayContaining(["illness"]) });
    expect(easeBackOffer(review)).toEqual({ reason: "time-off" });
    expect(easeBackOffer(reviewWeek(week, {}))).toEqual({ reason: "missed" });
  });

  it("doesn't offer it after a normal week", () => {
    const done = Object.fromEntries(runs.map((r) => [sessionKey(r.date, r.slot), { status: "completed", actualMinutes: r.plannedMinutes, effort: 5 } as CheckIn]));
    expect(easeBackOffer(reviewWeek(week, done))).toBeNull();
  });

  it("starts this week if nothing in it has happened yet, otherwise next Monday", () => {
    expect(easeBackStart(week, {}, false)).toBe(week.weekStart);
    expect(easeBackStart(week, {}, true)).toBe(weeks[4].weekStart);
    expect(easeBackStart(week, skip(week.sessions[0], "work_life"), false)).toBe(weeks[4].weekStart);
  });
});

describe("easing back in passes the plan checker", () => {
  it.each(Object.entries(PROFILES))("%s: a fully missed week, then easing back in", (_name, profile) => {
    const outline = buildPlanOutline(profile);
    const before = buildPlanWeeks(outline, build(profile)).map((b) => b.week);
    const missed = 3;
    if (before.length <= missed + 1) return;
    const start = before[missed + 1].weekStart;
    // Nothing was done in the missed week: the plan carries on from zero, as after time off.
    const rebuilt = rebuildOutline(outline, { ...profile, lastWeekRunMinutes: 0, longestRecentRunMinutes: 0, returning: true }, start);
    const after = buildPlanWeeks(rebuilt, build(profile)).map((b) => b.week).filter((w) => w.weekStart >= start);

    const history: PastWeek[] = before.slice(0, missed + 1).map((w, i) => ({
      totalMinutes: i === missed ? 0 : totalMinutes(w),
      runMinutes: i === missed ? 0 : runMinutes(w),
      phase: w.phase,
      // A missed week is a break in the build, like a week cut back for an injury.
      ...(i === missed && { injured: true }),
    }));
    for (const week of after) {
      const violations = ALL_RULES.flatMap((rule) =>
        rule(week, {
          availability: profile.availability,
          history: [...history],
          lastWeekRunMinutes: profile.lastWeekRunMinutes,
          targetDate: profile.targetDate,
          experienceLevel: profile.experienceLevel,
          strengthVolume: profile.strengthVolume,
          ...(profile.raceDistance === "ultra" && { ultraDistanceKm: profile.ultraDistanceKm }),
        }),
      );
      expect(violations.map((v) => `${v.rule}: ${v.message}`), `week ${week.weekNumber}`).toEqual([]);
      history.push({ totalMinutes: totalMinutes(week), runMinutes: runMinutes(week), phase: week.phase });
    }
  });
});
