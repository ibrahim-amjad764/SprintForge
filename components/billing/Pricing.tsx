// components/billing/Pricing.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Zap } from 'lucide-react';
import { startBillingCheckout } from '@/lib/checkout-client';

function checkoutNotice(params: URLSearchParams): string | null {
  if (params.get('checkout') === 'success') {
    return 'Checkout complete — your plan will activate momentarily.';
  }
  if (params.get('checkout') === 'cancelled' || params.get('cancel') === 'true') {
    return 'Checkout was cancelled.';
  }
  return null;
}

interface PlanInterval {
  purchasable: boolean;
  priceCents: number | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  limits: {
    maxProjectsPerWorkspace: number;
    maxMembersPerWorkspace: number;
    maxOwnedWorkspaces: number | null;
  };
  intervals: { month: PlanInterval; year: PlanInterval };
}

interface PlansResponse {
  currentPlan: string;
  plans: Plan[];
}

const FEATURES: Record<string, string[]> = {
  FREE: ['Up to 3 projects', 'Up to 3 members per workspace', '1 workspace'],
  PRO: ['Up to 25 projects', 'Up to 25 members per workspace', 'Unlimited workspaces'],
  TEAM: ['Up to 200 projects', 'Up to 200 members per workspace', 'Up to 10 workspaces'],
};

export default function Pricing() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const notice = checkoutNotice(searchParams);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/plans')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load plans'))))
      .then((json) => {
        if (!cancelled) setData(json.data ?? json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout(planId: string) {
    if (checkoutPlan) return; // prevent repeated submissions
    setCheckoutPlan(planId);
    setError(null);
    const outcome = await startBillingCheckout({
      plan: planId,
      interval,
      returnTo: '/pricing',
    });
    if (outcome.type === 'error') {
      setError(outcome.message);
      setCheckoutPlan(null);
    } else if (outcome.type === 'paddle-closed') {
      // Buyer dismissed the overlay without paying — re-enable CTA.
      setCheckoutPlan(null);
    }
    // 'redirect' / 'paddle-opened' navigate away or wait on Paddle.
  }

  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-3" aria-busy="true" aria-label="Loading plans">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-shimmer h-80 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-8 text-center">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div>
      {notice && (
        <p className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Interval toggle */}
      <div className="mb-8 flex items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/50 p-1">
          {(['month', 'year'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setInterval(v)}
              aria-pressed={interval === v}
              className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition-all duration-150 ${
                interval === v
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'month' ? 'Monthly' : 'Yearly'}
              {v === 'year' && (
                <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Save
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger grid gap-5 md:grid-cols-3">
        {data.plans.map((plan, i) => {
          const isCurrent = plan.id === data.currentPlan;
          const purchasable = plan.intervals[interval]?.purchasable;
          const isPro = plan.id === 'PRO';
          return (
            <div
              key={plan.id}
              style={{ '--i': i } as React.CSSProperties}
              className={`animate-enter relative flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-popover ${
                isCurrent
                  ? 'border-primary/50 ring-1 ring-primary/40'
                  : isPro
                    ? 'border-primary/25'
                    : 'border-border'
              }`}
            >
              {isPro && !isCurrent && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-glow">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Current plan
                </span>
              )}

              <h2 className="mt-1 text-lg font-bold tracking-tight">{plan.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

              {(() => {
                const cents = plan.intervals[interval]?.priceCents;
                if (cents == null) return null;
                const dollars = cents / 100;
                return (
                  <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                    ${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      /{interval === 'year' ? 'year' : 'month'}
                    </span>
                  </p>
                );
              })()}

              <ul className="mt-5 flex-1 space-y-2.5">
                {(FEATURES[plan.id] ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent || !!checkoutPlan || !purchasable}
                onClick={() => startCheckout(plan.id)}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                  isCurrent || !purchasable
                    ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                    : 'btn-sheen bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-glow hover:brightness-110 active:scale-[0.98]'
                }`}
              >
                {checkoutPlan === plan.id
                  ? 'Opening checkout…'
                  : isCurrent
                    ? 'Current plan'
                    : purchasable
                      ? `Choose ${plan.name}`
                      : 'Unavailable'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
