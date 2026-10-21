// "Forgot password" on the server (SPEC decision 61). A request makes a random
// token, stores only its SHA-256 hash, and emails a link with the token. Using
// the link sets the new password, logs out every device, and signs this one in.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { RESET_LINK_MINUTES, resetEmail, resetLinkProblem } from "@/lib/password-reset";
import { appUrl, sendEmail } from "./email";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Emails a reset link if the address has an account. Says nothing about whether it does. */
export async function sendResetLink(email: string): Promise<void> {
  await connection();
  const athlete = await db.athlete.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!athlete) return;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    // Only the newest link works, and old ones are tidied away.
    db.passwordReset.deleteMany({ where: { OR: [{ athleteId: athlete.id }, { expiresAt: { lt: new Date() } }] } }),
    db.passwordReset.create({ data: { id: hashToken(token), athleteId: athlete.id, expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000) } }),
  ]);
  await sendEmail({ to: email, ...resetEmail(`${appUrl()}/reset-password?token=${token}`, athlete.name) });
}

/** The reset link's row, and why it can't be used (or null if it can). */
export async function checkResetToken(token: string) {
  await connection();
  const row = token ? await db.passwordReset.findUnique({ where: { id: hashToken(token) }, include: { athlete: { select: { email: true } } } }) : null;
  return { row, problem: resetLinkProblem(row, new Date()) };
}

/** Uses the link: new password, every device logged out, link spent. */
export async function spendResetToken(id: string, athleteId: string, passwordHash: string) {
  await db.$transaction([
    db.athlete.update({ where: { id: athleteId }, data: { passwordHash } }),
    db.passwordReset.update({ where: { id }, data: { usedAt: new Date() } }),
    db.authSession.deleteMany({ where: { athleteId } }),
  ]);
}
