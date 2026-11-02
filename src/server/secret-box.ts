// Encrypting secrets ede. has to keep and use again, like Strava tokens (SPEC
// decision 83), unlike passwords and sign-in tokens, which are only hashed.
// AES-256-GCM with a 32-byte key from an environment variable, so a leaked
// database alone doesn't give the tokens away. Server only.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

/** The key from a base64 environment value (make one with `openssl rand -base64 32`), or null if it's missing or the wrong length. */
export function keyFrom(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value.trim(), "base64");
  return key.length === 32 ? key : null;
}

export function seal(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** The secret, or null if it was sealed with another key or has been changed. */
export function open(key: Buffer, sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
