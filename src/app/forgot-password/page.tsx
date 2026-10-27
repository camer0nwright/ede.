import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/reset-forms";
import { LegalLinks } from "@/components/legal-page";
import { Logo } from "@/components/logo";

export const metadata = { title: "Forgot password · ede." };

/** Asks for the account's email and sends a reset link (SPEC decision 61). */
export default function ForgotPasswordPage() {
  return (
    <main className="-mb-24 flex min-h-dvh flex-col gap-8 pt-6 pb-10">
      <Logo size="sm" />
      <header>
        <h1 className="text-4xl font-medium tracking-tighter">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the email you signed up with and ede. will send you a link to choose a new one.</p>
      </header>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
      <LegalLinks />
    </main>
  );
}
