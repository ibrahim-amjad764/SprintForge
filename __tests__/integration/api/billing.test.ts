// __tests__/integration/api/billing.test.ts
//
// Billing API coverage: checkout validation + auth, plan catalog,
// subscription read authz, portal authz, and webhook signature gate.

import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(async () => ({ email: 'user@test.com' })),
      })),
    })),
  },
}));

jest.mock('@/models/Subscription', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('@/services/billing.service', () => ({
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  getEffectivePlan: jest.fn(async () => 'FREE'),
  handleStripeEvent: jest.fn(async () => 'processed'),
}));

jest.mock('@/lib/stripe', () => ({
  __esModule: true,
  default: {
    webhooks: { constructEvent: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
  },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { requireSession } from '@/lib/session';
import Subscription from '@/models/Subscription';
import Workspace from '@/models/Workspace';
import {
  createCheckoutSession,
  createPortalSession,
} from '@/services/billing.service';
import stripe from '@/lib/stripe';
import { POST as checkoutPOST } from '@/app/api/billing/checkout/route';
import { POST as portalPOST } from '@/app/api/billing/portal/route';
import { GET as plansGET } from '@/app/api/billing/plans/route';
import { GET as subGET } from '@/app/api/billing/subscription/route';
import { POST as webhookPOST } from '@/app/api/billing/webhook/route';

const mockRequireSession = requireSession as jest.Mock;
const mockCheckout = createCheckoutSession as jest.Mock;
const mockPortal = createPortalSession as jest.Mock;
const mockConstructEvent = stripe.webhooks.constructEvent as jest.Mock;

const authed: AuthResult = {
  user: { userId: 'user-1', role: 'USER' },
  response: null,
} as unknown as AuthResult;
const unauth: AuthResult = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as unknown as AuthResult;

function postRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

function getRequest(query = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
    headers: new Headers(),
  } as unknown as NextRequest;
}

function webhookRequest(body: string, signature: string | null): NextRequest {
  const headers = new Headers();
  if (signature) headers.set('stripe-signature', signature);
  return {
    text: async () => body,
    headers,
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  mockRequireSession.mockResolvedValue(authed);
  (Workspace.findById as jest.Mock).mockReturnValue({
    select: jest.fn(() => ({
      lean: jest.fn(async () => ({ owner: 'user-1' })),
    })),
  });
});

describe('POST /api/billing/checkout', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireSession.mockResolvedValue(unauth);
    const res = await checkoutPOST(postRequest({ plan: 'PRO', interval: 'month' }));
    expect(res.status).toBe(401);
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('rejects invalid plan identifiers via service', async () => {
    mockCheckout.mockResolvedValue({ ok: false, status: 400, error: 'Invalid plan' });
    const res = await checkoutPOST(postRequest({ plan: 'FREE', interval: 'month' }));
    expect(res.status).toBe(400);
  });

  it('rejects client-supplied priceId — only plan+interval accepted', async () => {
    mockCheckout.mockResolvedValue({ ok: false, status: 400, error: 'Invalid plan' });
    const res = await checkoutPOST(
      postRequest({ plan: 'price_fake123', interval: 'month' }),
    );
    expect(mockCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'price_fake123', interval: 'month' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns checkout URL on success', async () => {
    mockCheckout.mockResolvedValue({
      ok: true,
      data: { url: 'https://checkout.stripe.com/x', sessionId: 'cs_1' },
    });
    const res = await checkoutPOST(postRequest({ plan: 'PRO', interval: 'year' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe('https://checkout.stripe.com/x');
  });

  it('surfaces conflict status (409) for duplicate subscriptions', async () => {
    mockCheckout.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'An active subscription already exists for this scope',
    });
    const res = await checkoutPOST(postRequest({ plan: 'PRO', interval: 'month' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/billing/portal', () => {
  it('returns portal URL when authorized', async () => {
    mockPortal.mockResolvedValue({ ok: true, data: { url: 'https://billing.stripe.com/p' } });
    const res = await portalPOST(postRequest({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe('https://billing.stripe.com/p');
  });

  it('propagates 404 when no billing account exists', async () => {
    mockPortal.mockResolvedValue({ ok: false, status: 404, error: 'No billing account found' });
    const res = await portalPOST(postRequest({}));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/billing/plans', () => {
  it('returns plan catalog with current plan', async () => {
    const res = await plansGET(getRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = json.data.plans.map((p: { id: string }) => p.id);
    expect(ids).toEqual(['FREE', 'PRO', 'TEAM']);
    expect(json.data.currentPlan).toBe('FREE');
  });

  it('returns 401 unauthenticated', async () => {
    mockRequireSession.mockResolvedValue(unauth);
    const res = await plansGET(getRequest());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/billing/subscription', () => {
  it('returns FREE default when no subscription exists', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => null),
        })),
      })),
    });
    const res = await subGET(getRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.plan).toBe('FREE');
    expect(json.data.subscription).toBeNull();
  });

  it('returns subscription details when present', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => ({
            plan: 'PRO',
            status: 'active',
            interval: 'month',
            currentPeriodEnd: new Date('2026-01-01'),
            stripeCustomerId: 'cus_1',
          })),
        })),
      })),
    });
    const res = await subGET(getRequest());
    const json = await res.json();
    expect(json.data.plan).toBe('PRO');
    expect(json.data.subscription.status).toBe('active');
    expect(json.data.hasBillingAccount).toBe(true);
    expect(json.data.provider).toBe('stripe'); // legacy doc, no provider field
  });

  it('reports paddle provider and billing account for Paddle subscriptions', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => ({
            plan: 'PRO',
            status: 'past_due',
            interval: 'year',
            provider: 'paddle',
            providerCustomerId: 'ctm_1',
          })),
        })),
      })),
    });
    const res = await subGET(getRequest());
    const json = await res.json();
    expect(json.data.provider).toBe('paddle');
    expect(json.data.subscription.status).toBe('past_due');
    expect(json.data.subscription.interval).toBe('year');
    expect(json.data.hasBillingAccount).toBe(true);
    // Customer IDs are never exposed to the client.
    expect(JSON.stringify(json)).not.toContain('ctm_1');
  });

  it('hasBillingAccount false for Paddle sub without customer', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => ({
            plan: 'FREE',
            status: 'canceled',
            provider: 'paddle',
          })),
        })),
      })),
    });
    const res = await subGET(getRequest());
    const json = await res.json();
    expect(json.data.hasBillingAccount).toBe(false);
  });

  it('workspace scope requires ownership', async () => {
    (Workspace.findById as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        lean: jest.fn(async () => ({ owner: 'someone-else' })),
      })),
    });
    const res = await subGET(getRequest('workspaceId=ws-1'));
    expect(res.status).toBe(403);
  });

  it('exposes provider-verified price and last-transaction snapshots', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => ({
            plan: 'PRO',
            status: 'active',
            interval: 'year',
            provider: 'paddle',
            providerCustomerId: 'ctm_1',
            priceCents: 19000,
            priceCurrency: 'USD',
            lastTransactionTotalCents: 20520,
            lastTransactionCurrency: 'USD',
            lastTransactionTaxCents: 1520,
            lastTransactionDiscountCents: 0,
            lastTransactionAt: new Date('2026-11-27T19:43:46.000Z'),
          })),
        })),
      })),
    });
    const res = await subGET(getRequest());
    const json = await res.json();
    expect(json.data.subscription.price).toEqual({
      amountCents: 19000,
      currency: 'USD',
    });
    expect(json.data.subscription.lastTransaction).toEqual({
      totalCents: 20520,
      currency: 'USD',
      taxCents: 1520,
      discountCents: 0,
      at: '2026-11-27T19:43:46.000Z',
    });
  });

  it('returns null price fields for legacy subscriptions without snapshots', async () => {
    (Subscription.findOne as jest.Mock).mockReturnValue({
      sort: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => ({
            plan: 'PRO',
            status: 'active',
            interval: 'month',
            provider: 'stripe',
            stripeCustomerId: 'cus_1',
          })),
        })),
      })),
    });
    const res = await subGET(getRequest());
    const json = await res.json();
    expect(json.data.subscription.price).toBeNull();
    expect(json.data.subscription.lastTransaction).toBeNull();
  });
});

describe('POST /api/billing/webhook', () => {
  it('returns 400 without stripe-signature header', async () => {
    const res = await webhookPOST(webhookRequest('{}', null));
    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await webhookPOST(webhookRequest('{}', 'bad_sig'));
    expect(res.status).toBe(400);
  });

  it('returns 500 when webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await webhookPOST(webhookRequest('{}', 'sig'));
    expect(res.status).toBe(500);
  });
});
