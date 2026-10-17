"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ProblemPage } from "@/components/problem-page";

/**
 * Something broke while showing a page. Nothing the athlete logged is lost
 * (sets and check-ins save as they happen). The reference matches the
 * server's log, without showing any details.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ProblemPage
      title="Something went wrong"
      action={
        <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" onClick={() => retry()}>
          Try again
        </Button>
      }
    >
      <p>ede. couldn&apos;t show this just now. Anything you&apos;ve already saved is safe. Try again, and if it keeps happening, come back in a few minutes.</p>
      {error.digest && <p className="mt-3 text-xs">Reference: {error.digest}</p>}
    </ProblemPage>
  );
}
