import Link from "next/link";
import { Logo } from "@/components/logo";

/** A calm full-page message for errors and missing pages, with a way back. */
export function ProblemPage({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6">
      <Logo size="sm" />
      <div className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-5 flex flex-col gap-2">
          {action}
          <Link href="/" className="grid h-12 place-items-center rounded-xl bg-secondary font-semibold text-secondary-foreground">
            Go to today
          </Link>
        </div>
      </div>
    </main>
  );
}
