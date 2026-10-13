"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ATHLETE_COOKIE, currentAthlete } from "@/server/athlete";
import { createSession, Credentials, dummyPasswordHash, endSession, hashPassword, verifyPassword } from "@/server/auth";

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

  if (await db.athlete.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, errors: ["There's already an account with that email. Log in instead."] };
  }
  try {
    await db.athlete.update({ where: { id: who.id }, data: { email, passwordHash: await hashPassword(password) } });
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

  const athlete = await db.athlete.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const ok = await verifyPassword(password, athlete?.passwordHash ?? (await dummyPasswordHash()));
  if (!athlete || !ok) return { ok: false, errors: ["That email and password don't match. Check them and try again."] };

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
