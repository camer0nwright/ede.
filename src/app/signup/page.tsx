import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resetToDemo } from "@/app/onboarding/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/logo";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/lib/db";
import { currentAthlete } from "@/server/athlete";

export const metadata = { title: "Create your account · ede." };

export default function SignUpPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SignUp />
    </Suspense>
  );
}

async function SignUp() {
  const who = await currentAthlete();
  if (who?.signedIn) redirect("/");
  const athlete = who ? await db.athlete.findUnique({ where: { id: who.id }, select: { name: true } }) : null;

  return (
    <main className="-mb-24 flex min-h-dvh flex-col gap-8 pt-6 pb-10">
      <Logo size="sm" />
      {athlete ? (
        <>
          <header>
            <p className="text-sm text-muted-foreground">Your plan is ready</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{athlete.name ? `Save it, ${athlete.name}` : "Save your plan"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Create your account to see your plan and log in on any device.</p>
          </header>
          <AuthForm mode="signup" />
          <div className="flex flex-col gap-3 text-center text-sm text-muted-foreground">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
            <form action={resetToDemo}>
              <button type="submit" className="underline underline-offset-4">
                Start again with the demo
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">Set up your plan first</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Answer a few questions about your training, then create your account to save the plan.
            </p>
          </header>
          <Link href="/onboarding" className="grid h-12 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
            Set up my plan
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
