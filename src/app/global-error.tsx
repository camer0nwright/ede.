"use client";

import "./globals.css";

/**
 * The last resort, when even the app's frame fails to load. It replaces the
 * whole page, so it brings its own html, body and styles, and stays plain.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-background text-foreground">
        <title>Something went wrong · ede.</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4">
          <p className="text-lg font-semibold">ede.</p>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">ede. couldn&apos;t load just now. Anything you&apos;ve already saved is safe.</p>
          <button type="button" onClick={() => retry()} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground">
            Try again
          </button>
          {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
