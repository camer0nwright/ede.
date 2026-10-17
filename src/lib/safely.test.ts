import { describe, expect, it, vi } from "vitest";
import { NO_CONNECTION, safely } from "./safely";

describe("calling the server safely", () => {
  it("passes results through", async () => {
    expect(await safely(async () => ({ ok: true as const }))).toEqual({ ok: true });
    expect(await safely(async () => ({ ok: false as const, errors: ["Too heavy"] }))).toEqual({ ok: false, errors: ["Too heavy"] });
  });

  it("turns a dropped connection into a 'not saved' result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await safely(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, errors: [NO_CONNECTION] });
  });

  it("lets redirects and not-found carry on", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/plan;307;" });
    await expect(safely(() => Promise.reject(redirect))).rejects.toBe(redirect);
    const notFound = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(safely(() => Promise.reject(notFound))).rejects.toBe(notFound);
  });
});
