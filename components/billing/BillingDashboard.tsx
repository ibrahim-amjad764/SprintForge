'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';

interface SubscriptionInfo {
  plan: string;
  subscription: {
    status: string;
    interval: 'month' | 'year' | null;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  } | null;
  provider?: 'stripe' | 'paddle';
  hasBillingAccount: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  trialing: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  past_due: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  canceled: 'border-border bg-muted text-muted-foreground',
  unpaid: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  incomplete: 'border-border bg-muted text-muted-foreground',
  incomplete_expired: 'border-border bg-muted text-muted-foreground',
  expired: 'border-border bg-muted text-muted-foreground',
  paused: 'border-border bg-muted text-muted-foreground',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/*
  Billing dashboard — renders the server-persisted subscription
  projection. Plan/status/periods come from /api/billing/subscription
  (webhook-synced), never from client-side assumptions.
*/
export default function BillingDashboard() {
  const [data, setData] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/subscription')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load subscription'))))
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

  async function openPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (!res.ok || !url) {
        throw new Error(json?.message || json?.error || 'Could not open billing portal');
      }
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal');
      setPortalLoading(false);
    }
  }

  if (loading) {
    return <div className="skeleton-shimmer mb-10 h-36 rounded-2xl border border-border bg-card" />;
  }
  if (!data) {
    return error ? (
      <p className="mb-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    ) : null;
  }

  const sub = data.subscription;

  return (
    <BillingDashboardCard
      data={data}
      sub={sub}
      portalLoading={portalLoading}
      error={error}
      onManageBilling={openPortal}
    />
  );
}

interface BillingDashboardCardProps {
  data: SubscriptionInfo;
  sub: SubscriptionInfo['subscription'];
  portalLoading: boolean;
  error: string | null;
  onManageBilling: () => void;
}

/*
  Presentational billing card — pure props, server-renderable.
  All subscription state originates from /api/billing/subscription
  (webhook-synced MongoDB projection); this component never derives
  entitlement from browser callbacks.
*/
export function BillingDashboardCard({
  data,
  sub,
  portalLoading,
  error,
  onManageBilling,
}: BillingDashboardCardProps) {
  const planName = data.plan === 'FREE' ? 'Free' : data.plan.charAt(0) + data.plan.slice(1).toLowerCase();
  const status = sub?.status ?? 'none';
  const periodEnd = formatDate(sub?.currentPeriodEnd ?? null);
  const trialEnd = formatDate(sub?.trialEnd ?? null);

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-glow">
            <CreditCard className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                {planName} plan
              </h2>
              {sub && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status] ?? STATUS_STYLES.canceled}`}
                >
                  {status.replace('_', ' ')}
                </span>
              )}
              {data.provider && data.provider !== 'stripe' && sub && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {data.provider}
                </span>
              )}
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {sub?.interval && (
                <div className="flex gap-1.5">
                  <dt className="font-mono text-[10px] uppercase tracking-wider">Billing</dt>
                  <dd>{sub.interval === 'year' ? 'Yearly' : 'Monthly'}</dd>
                </div>
              )}
              {periodEnd && (
                <div className="flex gap-1.5">
                  <dt className="font-mono text-[10px] uppercase tracking-wider">
                    {sub?.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
                  </dt>
                  <dd>{periodEnd}</dd>
                </div>
              )}
              {trialEnd && status === 'trialing' && (
                <div className="flex gap-1.5">
                  <dt className="font-mono text-[10px] uppercase tracking-wider">Trial ends</dt>
                  <dd>{trialEnd}</dd>
                </div>
              )}
            </dl>
            {sub?.cancelAtPeriodEnd && periodEnd && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                Cancellation scheduled — Pro access continues until {periodEnd}.
              </p>
            )}
            {status === 'past_due' && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                A payment failed — update your payment method to keep Pro access.
              </p>
            )}
          </div>
        </div>

        {data.hasBillingAccount && (
          <button
            onClick={onManageBilling}
            disabled={portalLoading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {portalLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            )}
            Manage billing
          </button>
        )}
      </div>
      {error && (
        <p className="border-t border-border px-6 py-3 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
