import { Suspense } from "react";
import { AppShell, BottomNav, NavBar, SideNav, SideNavBar } from "@/components/bottom-nav";
import { currentAthlete, getPlanContext } from "@/server/athlete";

/**
 * Who's using the app, for the foot of the sidebar. Only a signed-in account's
 * plan is loaded here: loading an unsaved plan sends you to sign-up, and this
 * runs on every page, sign-up included.
 */
async function Viewer() {
  const who = await currentAthlete();
  const ctx = who?.signedIn ? await getPlanContext() : null;
  const name = ctx?.name ?? (who ? "Your new plan" : "Example plan");
  const detail = ctx?.title ?? (who ? "Create your account to save it" : "Set up yours to start");
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
        {name.trim().charAt(0).toUpperCase() || "e"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold">{name}</span>
        <span className="block truncate text-xs text-panel-muted">{detail}</span>
      </span>
    </div>
  );
}

/** The sidebar, with Today pointing at the demo for visitors (who see the front page at /). */
async function ViewerSideNav() {
  const who = await currentAthlete();
  return <SideNav todayHref={who ? "/" : "/demo"} viewer={<Viewer />} />;
}

async function ViewerBottomNav() {
  const who = await currentAthlete();
  return <BottomNav todayHref={who ? "/" : "/demo"} />;
}

/** The app's frame: a phone-width column with the tab bar below, or the dark sidebar on wide screens. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={<SideNavBar active={null} />}>
          <ViewerSideNav />
        </Suspense>
      }
      bottomBar={
        <Suspense fallback={<NavBar active={null} />}>
          <ViewerBottomNav />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
