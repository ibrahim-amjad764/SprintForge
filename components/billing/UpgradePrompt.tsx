'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, X, ArrowRight, Check } from 'lucide-react';
import { startBillingCheckout } from '@/lib/checkout-client';

interface Props {
  open: boolean;
  onClose: () => void;
  // Internal path the user should return to after checkout.
  returnTo?: string;
}

const PRO_FEATURES = [
  'Unlimited workspaces',
  'Unlimited team members',
  'Advanced Kanban boards',
  'Sprint analytics',
  'AI-powered suggestions',
];

/*
  Premium upgrade prompt shown when a plan limit blocks an action
  (e.g. Free user creating a second workspace). Initiates Stripe
  Checkout for Pro monthly and returns the user to `returnTo`.
*/
export default function UpgradePrompt({ open, onClose, returnTo = '/workspace/new' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  useEffect(() => {
    if (!open) return;
    ctaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setError(null);
    const outcome = await startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo,
    });
    if (outcome.type === 'error') {
      setError(outcome.message);
      setLoading(false);
    } else if (outcome.type === 'paddle-closed') {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-transparent px-6 pt-6 pb-5">
          <button
            onClick={onClose}
            aria-label="Close upgrade prompt"
            className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-glow">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <h2 id="upgrade-title" className="mt-4 text-lg font-semibold tracking-tight">
            Workspace limit reached
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The Free plan includes <span className="font-medium text-foreground">1 workspace</span>.
            Upgrade to Pro for unlimited workspaces.
          </p>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums">$19</span>
            <span className="text-sm text-muted-foreground">/month · cancel anytime</span>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              ref={ctaRef}
              onClick={startCheckout}
              disabled={loading}
              className="btn-sheen flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Redirecting to checkout…' : 'Get Pro Plan'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
            <div className="flex gap-2.5">
              <button
                onClick={() => router.push('/pricing')}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                View pricing
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
