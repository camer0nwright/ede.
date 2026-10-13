// Accounts: email and password sign-in, kept entirely on the server.
// Passwords are hashed in ./passwords.ts. A signed-in device holds a random session token in an
// httpOnly cookie; the database stores only the token's SHA-256 hash, so a
// leaked database can't be used to sign in.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/lib/db";

export { Credentials, dummyPasswordHash, hashPassword, verifyPassword } from "./passwords";

export const SESSION_COOKIE = "ede_session";
const SESSION_DAYS = 90;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Signs this device in as the athlete. */
export async function createSession(athleteId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.authSession.create({ data: { id: hashToken(token), athleteId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

/** The signed-in athlete's id, or null. Expired sessions are removed. */
export async function sessionAthleteId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({ where: { id: hashToken(token) } });
  if (!session) return null;
  await connection(); // the expiry check reads the clock at request time
  if (session.expiresAt < new Date()) {
    await db.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.athleteId;
}

/** Signs this device out. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}
