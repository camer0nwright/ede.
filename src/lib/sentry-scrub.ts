// What leaves ede. in an error report (SPEC decision 71). Sentry gets the
// error, the page and the browser; never cookies, form contents, query strings
// (a reset link carries its token there), who the person is, or anything that
// looks like a password, token or email address.

type Crumb = { category?: string; data?: Record<string, unknown>; message?: string };
type ReportShape = {
  user?: unknown;
  request?: { url?: string; query_string?: unknown; cookies?: unknown; data?: unknown; headers?: Record<string, string> };
  breadcrumbs?: Crumb[];
  extra?: Record<string, unknown>;
  message?: string;
  exception?: { values?: { value?: string }[] };
};

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;
const SECRET = /\b(password|passwd|token|secret|authorization|cookie|api[_-]?key)\b(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,&}]+)/gi;

/** A URL without its query string or fragment. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Text with email addresses and secret-looking values blanked out. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(SECRET, (_, key: string, sep: string) => `${key}${sep}[removed]`);
}

/** Removes anything private from an error report before it's sent. Returns the same object, changed. */
export function scrubReport<T extends ReportShape>(event: T): T {
  delete event.user;
  delete event.extra;
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      const ua = event.request.headers["user-agent"] ?? event.request.headers["User-Agent"];
      event.request.headers = ua ? { "user-agent": ua } : {};
    }
  }
  if (event.message) event.message = scrubText(event.message);
  for (const v of event.exception?.values ?? []) if (v.value) v.value = scrubText(v.value);
  if (event.breadcrumbs) {
    // Console messages can hold anything; keep navigation and request crumbs, without their query strings.
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== "console")
      .map((b) => {
        const data = b.data ? { ...b.data } : undefined;
        for (const key of ["url", "from", "to"]) if (data && typeof data[key] === "string") data[key] = stripQuery(data[key] as string);
        return { ...b, ...(data && { data }), ...(b.message && { message: scrubText(b.message) }) };
      });
  }
  return event;
}
