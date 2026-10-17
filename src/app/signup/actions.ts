"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ATHLETE_COOKIE, currentAthlete } from "@/server/athlete";
import { passwordProblem } from "@/lib/auth-limits";
import { createSession, Credentials, dummyPasswordHash, endSession, hashPassword, verifyPassword } from "@/server/auth";
import { clearLoginFailures, loginBlocked, recordLoginFailure, recordSignup, signupBlocked } from "@/server/auth-limits";

export type AuthResult = { ok: false; errors: string[] };

/**
 * Creates an account for the plan just made on this device (SPEC decision 45):
 * the plan becomes the account's, and this device is signed in.
 */
export async function signUp(raw: unknown): Promise<AuthResult> {
  const parsed = Credentials.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const { email, password } = parsed.data;

  const who = await currentAthlete();
  if (who?.signedIn) redirect("/");
  if (!who) return { ok: false, errors: ["Set up your plan first, then create your account to save it."] };
  const weak = passwordProblem(password, email);
  if (weak) return { ok: false, errors: [weak] };
  const blocked = await signupBlocked();
  if (blocked) return { ok: false, errors: [blocked] };

  if (await db.athlete.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, errors: ["There's already an account with that email. Log in instead."] };
  }
  try {
    await db.athlete.update({ where: { id: who.id }, data: { email, passwordHash: await hashPassword(password), pendingTokenHash: null } });
    await recordSignup();
    await createSession(who.id);
  } catch (e) {
    console.error("Sign-up failed", e);
    return { ok: false, errors: ["Your account couldn't be created just now. Try again in a moment."] };
  }
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/plan");
}

const LogIn = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1, "Enter your password").max(200) });

/** Signs this device in. The same message for a wrong email or password, so it doesn't reveal who has an account. */
export async function logIn(raw: unknown): Promise<AuthResult> {
  const parsed = LogIn.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const { email, password } = parsed.data;

  // Too many recent failures: stop before checking the password at all.
  const blocked = await loginBlocked(email);
  if (blocked) return { ok: false, errors: [blocked] };

  const athlete = await db.athlete.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const ok = await verifyPassword(password, athlete?.passwordHash ?? (await dummyPasswordHash()));
  if (!athlete || !ok) {
    await recordLoginFailure(email);
    return { ok: false, errors: ["That email and password don't match. Check them and try again."] };
  }
  await clearLoginFailures(email);

  try {
    await createSession(athlete.id);
  } catch (e) {
    console.error("Log-in failed", e);
    return { ok: false, errors: ["You couldn't be logged in just now. Try again in a moment."] };
  }
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/");
}

/** Signs this device out; the demo shows again. */
export async function logOut() {
  await endSession();
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/");
}
