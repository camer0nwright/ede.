"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ATHLETE_COOKIE, currentAthlete } from "@/server/athlete";
import { newPasswordProblem, passwordProblem } from "@/lib/auth-limits";
import { createSession, Credentials, dummyPasswordHash, endOtherSessions, endSession, hashPassword, sessionAthleteId, verifyPassword } from "@/server/auth";
import { clearLoginFailures, loginBlocked, recordLoginFailure, recordResetRequest, recordSignup, resetBlocked, signupBlocked } from "@/server/auth-limits";
import { RESET_REQUESTED } from "@/lib/password-reset";
import { checkResetToken, sendResetLink, spendResetToken } from "@/server/password-reset";

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
    await db.athlete.update({ where: { id: who.id }, data: { email, passwordHash: await hashPassword(password), pendingTokenHash: null, termsAcceptedAt: new Date() } });
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

const ChangePassword = z.object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().max(200) });

export type AccountResult = { ok: true; message: string } | AuthResult;

/**
 * Changes the password after checking the current one (wrong guesses count
 * towards the same limit as logging in), then signs out every other device:
 * whoever had the old password loses access straight away.
 */
export async function changePassword(raw: unknown): Promise<AccountResult> {
  const parsed = ChangePassword.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const athleteId = await sessionAthleteId();
  if (!athleteId) return { ok: false, errors: ["Log in again to change your password."] };
  const athlete = await db.athlete.findUnique({ where: { id: athleteId }, select: { email: true, passwordHash: true } });
  if (!athlete?.email || !athlete.passwordHash) return { ok: false, errors: ["Log in again to change your password."] };

  const blocked = await loginBlocked(athlete.email);
  if (blocked) return { ok: false, errors: [blocked] };
  if (!(await verifyPassword(parsed.data.current, athlete.passwordHash))) {
    await recordLoginFailure(athlete.email);
    return { ok: false, errors: ["Your current password isn't right. Check it and try again."] };
  }
  const weak = newPasswordProblem(parsed.data.current, parsed.data.next, athlete.email);
  if (weak) return { ok: false, errors: [weak] };

  try {
    await db.athlete.update({ where: { id: athleteId }, data: { passwordHash: await hashPassword(parsed.data.next) } });
    const others = await endOtherSessions(athleteId);
    await clearLoginFailures(athlete.email);
    return { ok: true, message: others > 0 ? `Password changed. ${others} other ${others === 1 ? "device was" : "devices were"} logged out.` : "Password changed." };
  } catch (e) {
    console.error("Changing password failed", e);
    return { ok: false, errors: ["Your password couldn't be changed just now. Try again in a moment."] };
  }
}

/** Signs out every device on the account except this one. */
export async function logOutOtherDevices(): Promise<AccountResult> {
  const athleteId = await sessionAthleteId();
  if (!athleteId) return { ok: false, errors: ["Log in again to do that."] };
  const others = await endOtherSessions(athleteId);
  return { ok: true, message: others === 0 ? "No other devices were logged in." : `${others} other ${others === 1 ? "device" : "devices"} logged out.` };
}

const ResetRequest = z.object({ email: z.string().trim().toLowerCase().email("Enter the email you signed up with").max(200) });

/**
 * "Forgot password": emails a reset link if there's an account (SPEC decision
 * 61). The answer is the same either way, so it can't reveal who has one.
 */
export async function requestPasswordReset(raw: unknown): Promise<AccountResult> {
  const parsed = ResetRequest.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const { email } = parsed.data;
  const blocked = await resetBlocked(email);
  if (blocked) return { ok: false, errors: [blocked] };
  await recordResetRequest(email);
  try {
    await sendResetLink(email);
  } catch (e) {
    console.error("Sending a reset link failed", e);
  }
  return { ok: true, message: RESET_REQUESTED };
}

const ResetPassword = z.object({ token: z.string().min(1).max(200), password: z.string().max(200) });

/** Sets a new password from a reset link, logs out every device, and signs this one in. */
export async function resetPassword(raw: unknown): Promise<AuthResult> {
  const parsed = ResetPassword.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["That reset link isn't valid. Ask for a new one."] };
  const { row, problem } = await checkResetToken(parsed.data.token);
  if (problem || !row?.athlete.email) return { ok: false, errors: [problem ?? "That reset link isn't valid. Ask for a new one."] };

  const { password } = parsed.data;
  if (password.length < 8) return { ok: false, errors: ["Use at least 8 characters for your password"] };
  const weak = passwordProblem(password, row.athlete.email);
  if (weak) return { ok: false, errors: [weak] };

  try {
    await spendResetToken(row.id, row.athleteId, await hashPassword(password));
    await clearLoginFailures(row.athlete.email);
    await createSession(row.athleteId);
  } catch (e) {
    console.error("Resetting a password failed", e);
    return { ok: false, errors: ["Your password couldn't be changed just now. Try again in a moment."] };
  }
  (await cookies()).delete(ATHLETE_COOKIE);
  redirect("/?reset=1");
}
