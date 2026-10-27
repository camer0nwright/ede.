import { Suspense } from "react";
import { BottomNav, NavBar } from "@/components/bottom-nav";
import { currentAthlete } from "@/server/athlete";

/** The bottom bar, with Today pointing at the demo for visitors (who see the front page at /). */
async function ViewerNav() {
  const who = await currentAthlete();
  return <BottomNav todayHref={who ? "/" : "/demo"} />;
}

/** The app's frame: a phone-width column with the tab bar below. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-24">{children}</div>
      <Suspense fallback={<NavBar active={null} />}>
        <ViewerNav />
      </Suspense>
    </>
  );
}
