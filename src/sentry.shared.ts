// Settings shared by Sentry in the browser and on the server (SPEC decision 71).
// Errors only: no performance tracing, no session replay, no personal data,
// and every report scrubbed first. Off until NEXT_PUBLIC_SENTRY_DSN is set.
import type { BrowserOptions } from "@sentry/nextjs";
import { scrubReport } from "@/lib/sentry-scrub";

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Sentry collects all of these by default; ede. sends none of them.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { allow: ["user-agent"] },
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    genAI: { inputs: false, outputs: false },
  },
  tracesSampleRate: 0,
  beforeSend: (event) => scrubReport(event),
  beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
} satisfies BrowserOptions;
