import { describe, expect, it } from "vitest";
import { Credentials, hashPassword, verifyPassword } from "./passwords";

describe("accounts", () => {
  it("hashes passwords with a random salt and checks them", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong password", a)).toBe(false);
  });

  it("refuses hashes it doesn't recognise", async () => {
    expect(await verifyPassword("anything", "plaintext")).toBe(false);
  });

  it("normalises emails and asks for a longer password", () => {
    expect(Credentials.parse({ email: "  Cam@Example.COM ", password: "12345678" }).email).toBe("cam@example.com");
    expect(Credentials.safeParse({ email: "not-an-email", password: "12345678" }).success).toBe(false);
    expect(Credentials.safeParse({ email: "cam@example.com", password: "short" }).error?.issues[0].message).toMatch(/8 characters/);
  });
});
