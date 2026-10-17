"use client";

import Link from "next/link";

/**
 * Agreement to ede. keeping injury details, which count as health data
 * (SPEC decision 57). Asked wherever injury details are first entered.
 */
export function HealthConsentCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border bg-card p-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary-strong" />
      <span>
        I agree to ede. keeping these injury details to adjust my plan.{" "}
        <span className="text-muted-foreground">
          You can delete them at any time.{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-foreground">
            How ede. uses them
          </Link>
        </span>
      </span>
    </label>
  );
}
