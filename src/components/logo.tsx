import { cn } from "@/lib/utils";

/** The ede. mark: a lime dot with a soft halo, then the lowercase wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-full bg-primary/35" aria-hidden>
        <span className="size-5 rounded-full bg-primary" />
      </span>
      <span className="text-[26px] leading-none font-bold tracking-tight">ede.</span>
    </span>
  );
}
