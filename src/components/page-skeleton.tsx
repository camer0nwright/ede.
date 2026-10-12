/** A loading placeholder for pages while the athlete's plan loads. */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6 pt-8" aria-busy="true" aria-label="Loading">
      <div className="h-12 w-48 rounded bg-muted" />
      <div className="h-32 rounded-3xl bg-muted" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
