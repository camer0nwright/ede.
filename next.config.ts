import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV === "development";

// What the browser may load. Everything comes from ede. itself: fonts are
// bundled, there are no third-party scripts, and AI calls happen on the server.
// Next's inline start-up scripts need 'unsafe-inline' (nonces don't work with
// prerendered pages); the dev server also needs 'unsafe-eval'. The one outside
// frame is a form video from youtube-nocookie.com, loaded only on tap.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Never shown inside another site's frame (stops click-jacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Live site only: browsers always use https after the first visit.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  // Don't print server action inputs in the dev terminal: they include passwords.
  logging: { serverFunctions: false },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Development only: lets phones on the same Wi-Fi use the dev server (for
  // example http://192.168.0.147:3000). Home networks use 192.168.x.x.
  allowedDevOrigins: ["192.168.*.*"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Error reports (SPEC decision 71). Reports go through ede.'s own /monitoring
// route, so the security policy stays as it is and ad blockers don't drop
// them. With SENTRY_AUTH_TOKEN set (Vercel only), builds upload source maps so
// reports show the real code.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  telemetry: false,
});
