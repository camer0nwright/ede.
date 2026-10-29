import { Suspense } from "react";
import { headers } from "next/headers";
import { AppFrame } from "@/components/app-frame";
import { AppWelcome } from "@/components/landing/app-welcome";
import { Landing } from "@/components/landing/landing";
import { PageSkeleton } from "@/components/page-skeleton";
import { TodayScreen } from "@/components/today/today-screen";
import { isApp } from "@/lib/app-client";
import { currentAthlete } from "@/server/athlete";

export const metadata = {
  title: "ede. · Your hybrid training coach",
  description: "A running and strength plan that knows your goals, learns your rhythm, and changes when life does.",
};

/** The front page for visitors (SPEC decision 63), or the iPhone app's welcome screen (decision 81); Today for anyone with a plan. */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [who, query, requestHeaders] = await Promise.all([currentAthlete(), searchParams, headers()]);
  if (!who) return isApp(requestHeaders.get("user-agent")) ? <AppWelcome deleted={!!query.deleted} /> : <Landing deleted={!!query.deleted} />;
  return (
    <AppFrame>
      <Suspense fallback={<PageSkeleton />}>
        <TodayScreen query={query} />
      </Suspense>
    </AppFrame>
  );
}
