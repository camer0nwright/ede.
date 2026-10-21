import { Suspense } from "react";
import Link from "next/link";
import { NewPasswordForm } from "@/components/auth/reset-forms";
import { Logo } from "@/components/logo";
import { PageSkeleton } from "@/components/page-skeleton";
import { checkResetToken } from "@/server/password-reset";

export const metadata = { title: "Choose a new password · ede.", referrer: "no-referrer" };

/** Where a reset email's link lands: checks the link, then asks for the new password (SPEC decision 61). */
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <main className="-mb-24 flex min-h-dvh flex-col gap-8 pt-6 pb-10">
      <Logo size="sm" />
      <Suspense fallback={<PageSkeleton />}>
        <Reset searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reset({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const { row, problem } = await checkResetToken(value);

  if (problem || !row?.athlete.email) {
    return (
      <>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Link not working</h1>
          <p className="mt-2 text-sm text-muted-foreground">{problem ?? "That reset link isn't valid. Ask for a new one."}</p>
        </header>
        <Link href="/forgot-password" className="grid h-12 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">For {row.athlete.email}.</p>
      </header>
      <NewPasswordForm token={value} />
    </>
  );
}
