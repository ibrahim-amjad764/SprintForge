// components/ui/Skeleton.tsx
'use client';

interface SkeletonProps {
  className?: string;
}

/*
Shared skeleton placeholder — uses the muted token so it adapts to
both themes. Respects prefers-reduced-motion via tw-animate defaults.
*/
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

/* Convenience: a card-shaped skeleton row for list loading states. */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-3 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
