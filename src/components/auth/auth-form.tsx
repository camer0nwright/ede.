"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { logIn, signUp } from "@/app/(flow)/signup/actions";
import { Note } from "@/components/onboarding/choices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_AGE } from "@/lib/legal";
import { safely } from "@/lib/safely";

/** Email and password, for creating an account or logging in. */
export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const signup = mode === "signup";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors([]);
        startTransition(async () => {
          const result = await safely(() => (signup ? signUp : logIn)({ email, password }));
          if (result && !result.ok) setErrors(result.errors);
        });
      }}
    >
      <label className="text-sm font-medium">
        Email
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required className="mt-1.5 h-11" />
      </label>
      <label className="text-sm font-medium">
        Password
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          required
          className="mt-1.5 h-11"
        />
        {signup && <span className="mt-1.5 block text-xs font-normal text-muted-foreground">At least 8 characters.</span>}
      </label>
      {errors.length > 0 && <Note tone="caution">{errors.join(" ")}</Note>}
      <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-xl text-base font-semibold" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : signup ? "Create account and see my plan" : "Log in"}
      </Button>
      {signup && (
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            privacy policy
          </Link>
          , and confirm you&apos;re {MIN_AGE} or over.
        </p>
      )}
    </form>
  );
}
