import { describe, expect, it } from "vitest";
import { build } from "@/test/injured-plan";
import { PROFILES } from "@/test/profiles";
import type { WeekPlan } from "@/lib/domain";
import { buildPlanOutline } from "@/lib/plan-outline";
import { weekToEngine } from "@/lib/plan-engine";
import { buildPlanWeeks } from "@/lib/week-builder";
import { planEnginePrompt, tailorWeek, type AiReply, type AskModel } from "./plan-ai";

const input = PROFILES["half marathon, intermediate"];
const weeks = buildPlanWeeks(buildPlanOutline(input), build(input)).map((b) => b.week);
const baseline = weeks[3];
const ctx = { availability: input.availability, history: [], experienceLevel: input.experienceLevel, strengthVolume: input.strengthVolume, previousVersion: baseline };

/** A reply in the AI's shape for a given week. */
const replyFor = (week: WeekPlan, summary = "No changes needed."): AiReply => {
  const engine = weekToEngine(week);
  return {
    week: { ...engine, days: engine.days.map((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s, session_kind: s.session_kind ?? null, level: s.level ?? null })) })) },
    changes_summary: summary,
  };
};

/** A stand-in for Claude that returns the given replies in turn and records what it was sent. */
function fakeAsk(replies: (AiReply | null | "refusal")[]) {
  const calls: unknown[][] = [];
  const ask: AskModel = async (_system, messages) => {
    calls.push(structuredClone(messages));
    const next = replies.shift() ?? null;
    if (next === "refusal") return { reply: null, content: [], stopReason: "refusal" };
    return { reply: next, content: [{ type: "text", text: JSON.stringify(next) }], stopReason: next ? "end_turn" : "max_tokens" };
  };
  return { ask, calls };
}

// The baseline with a session added on a day that's a rest day in the athlete's week.
const restDay = input.availability.findIndex((d) => d.minutes === null);
const broken: WeekPlan = {
  ...baseline,
  sessions: [...baseline.sessions, { ...baseline.sessions.find((s) => s.type === "run")!, date: weeks[3].weekStart.replace(/\d\d$/, (dd) => String(Number(dd) + restDay).padStart(2, "0")), slot: 1 }],
};

describe("tailoring a week with the AI", () => {
  it("reads the system prompt from prompts/plan-engine.md, including how to adapt", () => {
    expect(planEnginePrompt()).toMatch(/HARD RULES/);
    expect(planEnginePrompt()).toMatch(/ADAPTING THE WEEK/);
  });

  it("accepts a week that passes the checker, with the coach's summary", async () => {
    const tweaked = { ...baseline, coachNote: "Nice consistent week. Keep the easy runs easy." };
    const { ask, calls } = fakeAsk([replyFor(tweaked, "Kept your plan: last week went well.")]);
    const result = await tailorWeek({ baseline, input: { athlete: "test" }, ctx, ask, system: "test" });
    expect(result).toMatchObject({ ok: true, attempts: 1, summary: "Kept your plan: last week went well." });
    expect(result.ok && result.week.coachNote).toMatch(/consistent/);
    // The AI is shown the week ede. built.
    expect(JSON.parse((calls[0][0] as { content: string }).content).baseline_week.week_number).toBe(baseline.weekNumber);
  });

  it("sends the checker's problems back, and accepts the fixed week", async () => {
    const { ask, calls } = fakeAsk([replyFor(broken), replyFor(baseline)]);
    const result = await tailorWeek({ baseline, input: {}, ctx, ask, system: "test" });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    const feedback = calls[1].at(-1) as { role: string; content: string };
    expect(feedback.role).toBe("user");
    expect(feedback.content).toMatch(/plan checker found these problems/);
    expect(feedback.content).toMatch(/fits-availability/);
  });

  it("keeps ede.'s own week if the AI still breaks a rule", async () => {
    const { ask } = fakeAsk([replyFor(broken), replyFor(broken)]);
    const result = await tailorWeek({ baseline, input: {}, ctx, ask, system: "test" });
    expect(result).toMatchObject({ ok: false, attempts: 2 });
    expect(!result.ok && result.reason).toMatch(/own week was kept/);
  });

  it("asks again when a reply can't be read, and stops on a refusal", async () => {
    const unreadable = fakeAsk([null, replyFor(baseline)]);
    expect(await tailorWeek({ baseline, input: {}, ctx, ask: unreadable.ask, system: "test" })).toMatchObject({ ok: true, attempts: 2 });
    const refused = fakeAsk(["refusal", replyFor(baseline)]);
    const result = await tailorWeek({ baseline, input: {}, ctx, ask: refused.ask, system: "test" });
    expect(result).toMatchObject({ ok: false });
    expect(refused.calls).toHaveLength(1);
  });

  it("doesn't blame the AI for problems ede.'s own week already had", async () => {
    const { ask } = fakeAsk([replyFor(broken)]);
    const result = await tailorWeek({ baseline: broken, input: {}, ctx: { ...ctx, previousVersion: broken }, ask, system: "test" });
    expect(result).toMatchObject({ ok: true, attempts: 1 });
  });
});
