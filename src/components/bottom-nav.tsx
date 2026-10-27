"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MessageCircle, Sun, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/you", label: "You", icon: User },
] as const;

/** The bar itself. `active` is null while the current page is still unknown. Visitors' Today is the demo. */
export function NavBar({ active, todayHref = "/" }: { active: string | null; todayHref?: string }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-lg pb-safe">
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
  // Full-screen flows with their own buttons at the bottom.
  if (pathname.startsWith("/onboarding") || pathname.startsWith("/you/edit") || pathname.startsWith("/you/injury") || pathname === "/signup" || pathname === "/login" || pathname.startsWith("/workout")) return null;
  const active = ITEMS.find(({ href }) => (href === "/" ? pathname === "/" || pathname === "/demo" : pathname.startsWith(href)))?.href ?? null;
  return <NavBar active={active} todayHref={todayHref} />;
}
