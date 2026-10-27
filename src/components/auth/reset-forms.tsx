"use client";

import { useState, useTransition } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset, resetPassword } from "@/app/(app)/signup/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safely } from "@/lib/safely";

const submitClass = "mt-2 h-12 w-full rounded-xl text-base font-semibold";

/** "Forgot password": asks for the email, then says a link is on its way (SPEC decision 61). */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm">
        <MailCheck className="size-5 text-primary-strong" aria-hidden />
        <p>{sent}</p>
        <p className="text-muted-foreground">Nothing there after a few minutes? Check your spam folder, or try again.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors([]);
        startTransition(async () => {
          const result = await safely(() => requestPasswordReset({ email }));
          if (!result.ok) return setErrors(result.errors);
          setSent(result.message);
        });
      }}
    >
      <label className="text-sm font-medium">
        Email
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required className="mt-1.5 h-11" />
      </label>
      {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
      <Button type="submit" size="lg" className={submitClass} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : "Email me a reset link"}
      </Button>
    </form>
  );
}

/** A new password, from a reset link. On success the server signs this device in and opens Today. */
export function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors([]);
        startTransition(async () => {
          const result = await safely(() => resetPassword({ token, password }));
          if (result && !result.ok) setErrors(result.errors);
        });
      }}
    >
      <label className="text-sm font-medium">
        New password
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required className="mt-1.5 h-11" />
        <span className="mt-1.5 block text-xs font-normal text-muted-foreground">At least 8 characters. Every device signed in to your account is logged out.</span>
      </label>
      {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
      <Button type="submit" size="lg" className={submitClass} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : "Save new password"}
      </Button>
    </form>
  );
}
