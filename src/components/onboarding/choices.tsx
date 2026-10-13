"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small pill that can be selected; used for quick single or multiple choices. */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors active:scale-[0.97]",
        selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A larger selectable card with a title and a short description. */
export function OptionCard({
  selected,
  onClick,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors active:scale-[0.99]",
        selected ? "border-foreground ring-1 ring-foreground" : "hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
          selected && "border-foreground bg-foreground text-background",
        )}
        aria-hidden
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2 font-medium">
          {title}
          {badge && <span className="text-xs font-medium text-primary-strong">{badge}</span>}
        </span>
        {description && <span className="mt-1 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

/** A labelled group of fields within a step. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-medium">{label}</legend>
      {hint && <p className="-mt-1.5 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Gentle notes (amber) and cautions (red) shown inside a step. */
export function Note({ tone = "info", children }: { tone?: "info" | "caution"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "caution" ? "alert" : undefined}
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "caution" ? "bg-hard/10" : "bg-muted",
      )}
    >
      {children}
    </p>
  );
}
