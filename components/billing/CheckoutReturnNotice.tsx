'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

/*
  Shows a checkout return notice on pages that don't otherwise
  surface the ?checkout= param (e.g. /dashboard). Wording is honest:
  payment success does NOT claim Pro is active — the webhook may
  still be in flight, so it says "will activate momentarily".
*/
export default function CheckoutReturnNotice() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get('checkout');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (checkout === 'success' || checkout === 'cancelled') {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
  }, [checkout]);

  if (!visible || (checkout !== 'success' && checkout !== 'cancelled')) return null;

  const success = checkout === 'success';
  return (
    <div
      role="status"
      className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
        success
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      {success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {success
        ? 'Checkout complete — your plan will activate momentarily.'
        : 'Checkout was cancelled — no charge was made.'}
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss notice"
        className="ml-auto rounded px-1.5 py-0.5 text-xs opacity-70 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
