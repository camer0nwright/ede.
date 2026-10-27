"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MessageCircle, Sun, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/you", label: "You", icon: User },
] as const;

const activeItem = (pathname: string) =>
  ITEMS.find(({ href }) => (href === "/" ? pathname === "/" || pathname === "/demo" : pathname.startsWith(href)))?.href ?? null;

/** The bar itself, on phones. `active` is null while the current page is still unknown. Visitors' Today is the demo. */
export function NavBar({ active, todayHref = "/" }: { active: string | null; todayHref?: string }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-lg pb-safe md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = active === href;
          return (
            <li key={href}>
              <Link
                href={href === "/" ? todayHref : href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  on ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={on ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reads the URL to highlight the current tab. Wrap in Suspense with <NavBar active={null} />. */
export function BottomNav({ todayHref = "/" }: { todayHref?: string }) {
  const pathname = usePathname();
  return <NavBar active={activeItem(pathname)} todayHref={todayHref} />;
}

/**
 * The dark sidebar on wider screens (SPEC decision 64), from the Figma
 * design: logo, the four sections, and who's signed in at the foot.
 */
export function SideNavBar({ active, todayHref = "/", viewer }: { active: string | null; todayHref?: string; viewer?: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[230px] flex-col bg-panel px-6 pt-9 pb-6 text-panel-foreground md:flex">
      <Link href={todayHref} aria-label="ede. Today" className="px-1">
        <Logo />
      </Link>
      <nav aria-label="Main" className="mt-12">
        <ul className="flex flex-col gap-2">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const on = active === href;
            return (
              <li key={href}>
                <Link
                  href={href === "/" ? todayHref : href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-[50px] items-center gap-3 rounded-[5px] px-4 text-sm transition-colors",
                    on ? "bg-white/10 text-panel-foreground" : "text-panel-muted hover:bg-white/5 hover:text-panel-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto border-t border-white/10 pt-5">{viewer}</div>
    </aside>
  );
}

/** The sidebar with the current section highlighted. Reads the URL, so wrap in Suspense with <SideNavBar active={null} />. */
export function SideNav({ todayHref = "/", viewer }: { todayHref?: string; viewer?: React.ReactNode }) {
  const pathname = usePathname();
  return <SideNavBar active={activeItem(pathname)} todayHref={todayHref} viewer={viewer} />;
}

/**
 * The frame around every app screen: sidebar on wide screens, tab bar on
 * phones. Full-screen flows use the (flow) layout instead, so nothing here
 * needs to read the URL outside Suspense (which would stop pages being
 * prerendered).
 */
export function AppShell({ children, sidebar, bottomBar }: { children: React.ReactNode; sidebar: React.ReactNode; bottomBar: React.ReactNode }) {
  return (
    <>
      {sidebar}
      <div className="md:pl-[230px]">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-24 md:max-w-3xl md:px-12 md:pb-16 lg:max-w-5xl lg:px-16">{children}</div>
      </div>
      {bottomBar}
    </>
  );
}
