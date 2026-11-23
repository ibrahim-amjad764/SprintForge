// components/ui/LoadingSpinner.tsx
'use client';

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

/*
Shared loading indicator — theme-aware via border tokens, announces
itself to screen readers.
*/
export default function LoadingSpinner({
  label = 'Loading',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
