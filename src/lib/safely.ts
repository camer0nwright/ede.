// Calling a server action from the browser when the connection may drop (a
// gym basement, a run with no signal). A failed request becomes an ordinary
// "couldn't save" result the screen already knows how to show, instead of a
// crash or, worse, a tick that looks saved but isn't.

export const NO_CONNECTION = "No signal: that wasn't saved. Check your connection and try again.";

export type Failed = { ok: false; errors: string[] };

/** Next.js signals redirects and not-found by throwing; those must carry on. */
const isNavigation = (e: unknown) =>
  typeof e === "object" && e !== null && "digest" in e && typeof e.digest === "string" && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test(e.digest);

export async function safely<T>(call: () => Promise<T>): Promise<T | Failed> {
  try {
    return await call();
  } catch (e) {
    if (isNavigation(e)) throw e;
    console.error("A request failed", e);
    return { ok: false, errors: [NO_CONNECTION] };
  }
}
