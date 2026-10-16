// Tailoring a week with the AI (SPEC decision 51, prompts/plan-engine.md).
// ede.'s code builds every week; the AI adapts the coming week to how training
// has actually gone (check-ins, efforts, notes, skips) and explains what it
// changed. The plan checker validates the result: problems go back to the AI
// once, and if it still breaks a rule ede.'s own week is kept. Server only.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BodyFocus, DAY_NAMES, Intensity, Phase, RunKind, type WeekPlan } from "@/lib/domain";
import { EngineWeek, toWeekPlan, weekToEngine } from "@/lib/plan-engine";
import { ALL_RULES, type CheckContext, type Violation } from "@/server/plan-checker/rules";
import { describeViolations } from "@/server/plan-checker";

export const AI_MODEL = "claude-opus-5-5";
/** Attempts before keeping ede.'s own week: the first reply, then one fix after the checker's feedback. */
export const AI_ATTEMPTS = 2;

/** Whether an API key is configured (added to .env by the developer, never committed). */
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

// The reply's shape, for structured outputs: the engine's week (validated in
// full by EngineWeek and the checker afterwards) plus a plain-words summary.
const ReplySession = z.object({
  type: z.enum(["run", "strength"]),
  title: z.string(),
  duration_minutes: z.number().int(),
  intensity: Intensity,
  is_key_session: z.boolean(),
  body_focus: BodyFocus.nullable(),
  session_kind: RunKind.nullable(),
  level: z.number().int().nullable(),
  steps: z.array(z.object({ name: z.string(), duration_minutes: z.number(), target_effort_rpe: z.number() })),
  exercises: z.array(
    z.object({ name: z.string(), warmup_sets: z.number().int(), working_sets: z.number().int(), reps: z.string(), target_rpe: z.number(), failure_allowed: z.boolean() }),
  ),
});
export const AiReply = z.object({
  week: z.object({
    week_number: z.number().int(),
    phase: Phase,
    total_minutes: z.number(),
    run_minutes: z.number(),
    strength_minutes: z.number(),
    days: z.array(z.object({ day: z.enum(DAY_NAMES), sessions: z.array(ReplySession), notes: z.string() })),
    coach_note: z.string(),
  }),
  changes_summary: z.string(),
});
export type AiReply = z.infer<typeof AiReply>;

/** One call to the model: the reply (null if it couldn't be read), and the content to append on a retry. */
export type AskModel = (
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
) => Promise<{ reply: AiReply | null; content: Anthropic.Beta.BetaContentBlockParam[]; stopReason: string | null }>;

let systemPrompt: string | undefined;
/** The system prompt: the code block in prompts/plan-engine.md, so the prompt lives in one place. */
export function planEnginePrompt(): string {
  if (systemPrompt) return systemPrompt;
  const file = fs.readFileSync(path.join(process.cwd(), "prompts", "plan-engine.md"), "utf8");
  const block = file.match(/```\n([\s\S]*?)\n```/);
  if (!block) throw new Error("prompts/plan-engine.md has no prompt block.");
  return (systemPrompt = block[1]);
}

/** The real call: Claude with structured outputs, adaptive thinking and server-side refusal fallbacks. */
export function claudeAsk(client = new Anthropic()): AskModel {
  return async (system, messages) => {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(AiReply) },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    });
    return {
      reply: response.stop_reason === "end_turn" ? (response.parsed_output ?? null) : null,
      content: response.content as Anthropic.Beta.BetaContentBlockParam[],
      stopReason: response.stop_reason,
    };
  };
}

/** Problems the AI's week has that ede.'s own week didn't (counted by rule and day). */
export function newViolations(baseline: WeekPlan, week: WeekPlan, ctx: CheckContext): Violation[] {
  const key = (v: Violation) => `${v.rule}|${v.date ?? ""}`;
  const existing = new Map<string, number>();
  for (const v of ALL_RULES.flatMap((rule) => rule(baseline, ctx))) existing.set(key(v), (existing.get(key(v)) ?? 0) + 1);
  return ALL_RULES.flatMap((rule) => rule(week, ctx)).filter((v) => {
    const left = existing.get(key(v)) ?? 0;
    if (left > 0) existing.set(key(v), left - 1);
    return left === 0;
  });
}

/** The reply's week as ede.'s WeekPlan, or the reasons it can't be used. */
function readReply(reply: AiReply, weekStart: string): { week: WeekPlan } | { errors: string[] } {
  const engine = {
    ...reply.week,
    days: reply.week.days.map((d) => ({
      ...d,
      sessions: d.sessions.map(({ session_kind, level, ...s }) => ({
        ...s,
        ...(session_kind && { session_kind }),
        ...(level && { level }),
      })),
    })),
  };
  const parsed = EngineWeek.safeParse(engine);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `Invalid plan format at ${i.path.join(".") || "root"}: ${i.message}`) };
  return { week: toWeekPlan(parsed.data, weekStart) };
}

export type TailorResult =
  | { ok: true; week: WeekPlan; summary: string; attempts: number }
  | { ok: false; reason: string; attempts: number };

/**
 * Asks the AI to adapt `baseline` (the week ede. built) using `input`, checks
 * the result, and gives the AI the checker's feedback once. The week ede.
 * built is the fallback: on failure the caller keeps it.
 */
export async function tailorWeek(opts: { baseline: WeekPlan; input: object; ctx: CheckContext; ask: AskModel; system?: string }): Promise<TailorResult> {
  const system = opts.system ?? planEnginePrompt();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: JSON.stringify({ ...opts.input, baseline_week: weekToEngine(opts.baseline) }) },
  ];
  let reason = "The coach couldn't adapt this week.";
  for (let attempt = 1; attempt <= AI_ATTEMPTS; attempt++) {
    const answer = await opts.ask(system, messages);
    if (!answer.reply) {
      reason = answer.stopReason === "refusal" ? "The coach declined to adapt this week." : "The coach's reply couldn't be read.";
      if (answer.stopReason === "refusal") break;
      messages.push({ role: "assistant", content: answer.content }, { role: "user", content: "That reply couldn't be read. Return the whole week again in the required JSON shape." });
      continue;
    }
    const read = readReply(answer.reply, opts.baseline.weekStart);
    const problems = "errors" in read ? read.errors.map((message) => ({ rule: "week-structure" as const, message })) : newViolations(opts.baseline, read.week, opts.ctx);
    if ("week" in read && problems.length === 0) {
      return { ok: true, week: { ...read.week, weekNumber: opts.baseline.weekNumber, phase: opts.baseline.phase }, summary: answer.reply.changes_summary.trim(), attempts: attempt };
    }
    reason = `The coach's week broke ${problems.length === 1 ? "a training rule" : `${problems.length} training rules`}, so ede.'s own week was kept.`;
    messages.push(
      { role: "assistant", content: answer.content },
      {
        role: "user",
        content: `ede.'s plan checker found these problems with your week:\n${describeViolations(problems)}\nFix every one and return the whole week again in the same JSON shape. Keep everything else as it was.`,
      },
    );
  }
  return { ok: false, reason, attempts: AI_ATTEMPTS };
}
