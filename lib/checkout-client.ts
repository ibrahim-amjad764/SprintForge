// lib/checkout-client.ts
//
// Shared client-side checkout initiation for Stripe (redirect) and
// Paddle (overlay). The server decides price IDs and reservation
// state; this module only transports the request and executes the
// provider-specific UX. No entitlement is ever granted client-side.

import { openPaddleCheckout } from '@/lib/paddle-checkout';

export interface CheckoutRequest {
  plan: string;
  interval: 'month' | 'year';
  returnTo: string;
  workspaceId?: string | null;
}

export type CheckoutOutcome =
  | { type: 'redirect'; url: string }
  | { type: 'paddle-opened' }
  | { type: 'paddle-closed' }
  | { type: 'error'; message: string };

interface PaddleCheckoutPayload {
  priceId: string;
  customerId: string;
  customData: Record<string, string>;
  reservationId: string;
}

function isPaddleCheckout(value: unknown): value is PaddleCheckoutPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PaddleCheckoutPayload).priceId === 'string' &&
    typeof (value as PaddleCheckoutPayload).customerId === 'string'
  );
}

/*
  Paddle is the primary provider for new PRO subscriptions. Stripe
  remains the fallback/default when no Paddle client token is
  configured.

  NO automatic provider fallback after a failed Paddle attempt:
  the server may already hold a pending Paddle CheckoutReservation
  for this scope, and the cross-provider pending lock would 409 a
  Stripe attempt anyway — silently retrying on Stripe could also
  race a Paddle transaction already in flight. Provider selection
  stays explicit; the user sees the error and can retry.
*/
function preferredProvider(plan: string): 'paddle' | 'stripe' {
  return plan === 'PRO' && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    ? 'paddle'
    : 'stripe';
}

export async function startBillingCheckout(
  req: CheckoutRequest,
): Promise<CheckoutOutcome> {
  const provider = preferredProvider(req.plan);

  let res: Response;
  try {
    res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: req.plan,
        interval: req.interval,
        returnTo: req.returnTo,
        workspaceId: req.workspaceId ?? undefined,
        provider,
      }),
    });
  } catch {
    return { type: 'error', message: 'Network error — please try again' };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      type: 'error',
      message:
        json?.error || json?.message || 'Checkout failed — please try again',
    };
  }

  const data = json?.data ?? json;

  // Paddle overlay checkout.
  if (data?.provider === 'paddle' && isPaddleCheckout(data.paddleCheckout)) {
    const sep = req.returnTo.includes('?') ? '&' : '?';
    const result = await openPaddleCheckout({
      priceId: data.paddleCheckout.priceId,
      customerId: data.paddleCheckout.customerId,
      customData: data.paddleCheckout.customData,
      successUrl: `${window.location.origin}${req.returnTo}${sep}checkout=success`,
    });
    if (result === 'completed') {
      // Paddle redirects to successUrl itself; entitlement still
      // activates via webhook — the landing page shows the honest
      // "activating" notice.
      return { type: 'paddle-opened' };
    }
    if (result === 'closed') return { type: 'paddle-closed' };
    return { type: 'error', message: 'Paddle checkout is unavailable' };
  }

  // Stripe hosted checkout redirect.
  const url = data?.url;
  if (typeof url === 'string' && url) {
    window.location.assign(url);
    return { type: 'redirect', url };
  }

  return { type: 'error', message: 'Checkout failed — please try again' };
}
