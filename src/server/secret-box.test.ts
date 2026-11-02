import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { keyFrom, open, seal } from "./secret-box";

// Encrypted Strava tokens (SPEC decision 83).

const key = randomBytes(32);

describe("keeping secrets encrypted", () => {
  it("gets back what it sealed, and never stores it as is", () => {
    const sealed = seal(key, "a-strava-token");
    expect(sealed).not.toContain("a-strava-token");
    expect(open(key, sealed)).toBe("a-strava-token");
  });

  it("seals the same secret differently each time", () => {
    expect(seal(key, "same")).not.toBe(seal(key, "same"));
  });

  it("won't open with another key, or after a change", () => {
    const sealed = seal(key, "a-strava-token");
    expect(open(randomBytes(32), sealed)).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("something else").toString("base64url");
    expect(open(key, parts.join("."))).toBeNull();
    expect(open(key, "not sealed")).toBeNull();
  });

  it("only takes a 32-byte key", () => {
    expect(keyFrom(randomBytes(32).toString("base64"))).toHaveLength(32);
    expect(keyFrom(randomBytes(16).toString("base64"))).toBeNull();
    expect(keyFrom(undefined)).toBeNull();
  });
});
