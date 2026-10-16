// Recording and checking log-in and sign-up attempts (SPEC decision 54).
// Network addresses are stored only as a SHA-256 fingerprint, and records
// older than a day are removed. Server only.
import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { connection } from "next/server";
import { LIMITS, tryAgainIn, waitSeconds, type Limit } from "@/lib/auth-limits";
import { db } from "@/lib/db";

const KEEP_HOURS = 24;

/** This request's network, as a fingerprint ("ip:<sha256>"). Local development has no forwarded address. */
async function networkKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `ip:${createHash("sha256").update(ip).digest("hex")}`;
}
const emailKey = (email: string) => `email:${email.toLowerCase()}`;

async function wait(key: string, kind: string, limit: Limit): Promise<number | null> {
  await connection(); // limits are judged against the clock at request time
  const since = new Date(Date.now() - limit.windowMinutes * 60 * 1000);
  const rows = await db.authAttempt.findMany({ where: { key, kind, createdAt: { gte: since } }, select: { createdAt: true } });
  return waitSeconds(
    rows.map((r) => r.createdAt),
    new Date(),
    limit,
  );
}

async function record(key: string, kind: string) {
  await db.authAttempt.create({ data: { key, kind } });
  // Tidy away old records as we go.
  await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_HOURS * 60 * 60 * 1000) } } });
}

/** Why a log-in can't be tried right now, or null. */
export async function loginBlocked(email: string): Promise<string | null> {
  const forEmail = await wait(emailKey(email), "login_failed", LIMITS.emailFailures);
  if (forEmail) return `Too many wrong passwords for this account. ${tryAgainIn(forEmail)}`;
  const forNetwork = await wait(await networkKey(), "login_failed", LIMITS.networkFailures);
  if (forNetwork) return `Too many failed log-ins from this network. ${tryAgainIn(forNetwork)}`;
  return null;
}

export async function recordLoginFailure(email: string) {
  await record(emailKey(email), "login_failed");
  await record(await networkKey(), "login_failed");
}

/** A successful log-in clears that account's failed tries. */
export async function clearLoginFailures(email: string) {
  await db.authAttempt.deleteMany({ where: { key: emailKey(email), kind: "login_failed" } });
}

/** Why a sign-up can't happen right now, or null. */
export async function signupBlocked(): Promise<string | null> {
  const seconds = await wait(await networkKey(), "signup", LIMITS.signups);
  return seconds ? `Too many new accounts from this network. ${tryAgainIn(seconds)}` : null;
}

export async function recordSignup() {
  await record(await networkKey(), "signup");
}
