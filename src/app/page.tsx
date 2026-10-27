import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { Landing } from "@/components/landing/landing";
import { PageSkeleton } from "@/components/page-skeleton";
import { TodayScreen } from "@/components/today/today-screen";
import { currentAthlete } from "@/server/athlete";

export const metadata = {
  title: "ede. · Your hybrid training coach",
  description: "A running and strength plan that knows your goals, learns your rhythm, and changes when life does.",
};

/** The front page for visitors (SPEC decision 63); Today for anyone with a plan. */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [who, query] = await Promise.all([currentAthlete(), searchParams]);
  if (!who) return <Landing deleted={!!query.deleted} />;
  return (
    <AppFrame>
      <Suspense fallback={<PageSkeleton />}>
        <TodayScreen query={query} />
      </Suspense>
    </AppFrame>
  );
}
