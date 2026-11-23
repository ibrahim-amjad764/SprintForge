// __tests__/unit/components/billing.test.tsx
//
// Billing UI smoke tests. Jest runs in the node environment (no DOM),
// so these verify server-render output of the billing components —
// hooks/effects don't run, which is exactly the loading/empty state.
// Interactive behavior is covered by Playwright e2e.

import { describe, it, expect, beforeEach } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const mockSearchParams = { value: '' };

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams.value),
}));

import BillingDashboard, {
  BillingDashboardCard,
} from '@/components/billing/BillingDashboard';
import CheckoutReturnNotice from '@/components/billing/CheckoutReturnNotice';

describe('BillingDashboard', () => {
  it('renders a loading skeleton before subscription data resolves', () => {
    const html = renderToStaticMarkup(createElement(BillingDashboard));
    expect(html).toContain('skeleton-shimmer');
  });
});

function cardHtml(overrides: {
  plan?: string;
  provider?: 'stripe' | 'paddle';
  sub?: Record<string, unknown> | null;
  hasBillingAccount?: boolean;
}) {
  const data = {
    plan: overrides.plan ?? 'PRO',
    provider: overrides.provider ?? 'stripe',
    subscription: overrides.sub === undefined
      ? {
          status: 'active',
          interval: 'month',
          currentPeriodEnd: '2026-12-01T00:00:00.000Z',
          trialEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        }
      : overrides.sub,
    hasBillingAccount: overrides.hasBillingAccount ?? true,
  };
  return renderToStaticMarkup(
    createElement(BillingDashboardCard, {
      data,
      sub: data.subscription as never,
      portalLoading: false,
      error: null,
      onManageBilling: () => {},
    }),
  );
}

describe('BillingDashboardCard — subscription status display', () => {
  it('renders active status with renewal date', () => {
    const html = cardHtml({});
    expect(html).toContain('active');
    expect(html).toContain('Renews');
    expect(html).toContain('Manage billing');
  });

  it('renders past_due status with payment warning', () => {
    const html = cardHtml({
      sub: {
        status: 'past_due',
        interval: 'month',
        currentPeriodEnd: '2026-12-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
    expect(html).toContain('past due');
    expect(html).toContain('payment failed');
  });

  it('renders cancel-at-period-end state with end date', () => {
    const html = cardHtml({
      sub: {
        status: 'active',
        interval: 'year',
        currentPeriodEnd: '2026-12-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: true,
        canceledAt: null,
      },
    });
    expect(html).toContain('Cancellation scheduled');
    expect(html).toContain('Ends');
    expect(html).toContain('Yearly');
  });

  it('renders canceled subscription without billing actions', () => {
    const html = cardHtml({
      hasBillingAccount: false,
      sub: {
        status: 'canceled',
        interval: null,
        currentPeriodEnd: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(html).toContain('canceled');
    expect(html).not.toContain('Manage billing');
  });

  it('renders paused and expired statuses gracefully', () => {
    for (const status of ['paused', 'incomplete_expired']) {
      const html = cardHtml({
        sub: {
          status,
          interval: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
      expect(html).toContain(status.replace('_', ' '));
    }
  });

  it('shows the Paddle provider badge for Paddle subscriptions', () => {
    const html = cardHtml({ provider: 'paddle' });
    expect(html).toContain('paddle');
  });

  it('hides the provider badge for Stripe subscriptions', () => {
    const html = cardHtml({ provider: 'stripe' });
    expect(html).not.toContain('>stripe<');
  });

  it('renders Free plan without a subscription', () => {
    const html = cardHtml({
      plan: 'FREE',
      hasBillingAccount: false,
      sub: null,
    });
    expect(html).toContain('Free plan');
    expect(html).not.toContain('Manage billing');
  });
});

describe('CheckoutReturnNotice', () => {
  beforeEach(() => {
    mockSearchParams.value = '';
  });

  it('renders nothing without a checkout param', () => {
    const html = renderToStaticMarkup(createElement(CheckoutReturnNotice));
    expect(html).toBe('');
  });

  it('renders nothing for an unrecognized checkout value', () => {
    mockSearchParams.value = 'checkout=bogus';
    const html = renderToStaticMarkup(createElement(CheckoutReturnNotice));
    expect(html).toBe('');
  });
});
