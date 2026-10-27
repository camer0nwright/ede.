import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { LegalLinks } from "@/components/legal-page";
import { Logo } from "@/components/logo";
import { PageSkeleton } from "@/components/page-skeleton";
import { sessionAthleteId } from "@/server/auth";

export const metadata = { title: "Log in · ede." };

export default function LogInPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LogIn />
    </Suspense>
  );
}

async function LogIn() {
  if (await sessionAthleteId()) redirect("/");
  return (
    <main className="-mb-24 flex min-h-dvh flex-col gap-8 pt-6 pb-10">
      <Logo size="sm" />
      <header>
        <p className="label-eyebrow text-muted-foreground">Welcome back</p>
        <h1 className="mt-2 text-5xl font-medium tracking-tighter">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your plan is where you left it.</p>
      </header>
      <AuthForm mode="login" />
      <p className="-mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Forgot your password?
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        New to ede.?{" "}
        <Link href="/onboarding" className="font-medium text-foreground underline underline-offset-4">
          Set up your plan
        </Link>
      </p>
      <LegalLinks />
    </main>
  );
}
