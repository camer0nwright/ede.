import { cn } from "@/lib/utils";

/** The ede. mark: a lime dot with a soft halo, then the lowercase wordmark. */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span className={cn("inline-flex items-center", sm ? "gap-1.5" : "gap-2.5", className)}>
      <span className={cn("grid place-items-center rounded-full bg-primary/35", sm ? "size-5" : "size-8")} aria-hidden>
        <span className={cn("rounded-full bg-primary", sm ? "size-3" : "size-5")} />
      </span>
      <span className={cn("leading-none font-bold tracking-tight", sm ? "text-base" : "text-[26px]")}>ede.</span>
    </span>
  );
}
