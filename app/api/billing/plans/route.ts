// app/api/billing/plans/route.ts
import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/session';
import { PLANS, PURCHASABLE_PLANS, getProviderPriceId } from '@/lib/plans';
import { getEffectivePlan } from '@/services/billing.service';
import { successResponse } from '@/utils/response';
import { apiError } from '@/utils/error-handler';

/*
GET /api/billing/plans?workspaceId=

Public-to-authenticated plan catalog for the pricing UI. Returns plan
metadata, limits, and whether each interval is purchasable (i.e. a
Stripe price is configured). No Stripe IDs or secrets are exposed —
the client only sends plan+interval back to /checkout.
*/
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    const plans = PURCHASABLE_PLANS.map((id) => {
      const plan = PLANS[id];
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        limits: plan.limits,
        intervals: {
          month: {
            // Purchasable via ANY configured provider (Stripe or Paddle).
            purchasable:
              !!getProviderPriceId('stripe', id, 'month') ||
              !!getProviderPriceId('paddle', id, 'month'),
            priceCents: plan.displayPriceCents.month,
          },
          year: {
            purchasable:
              !!getProviderPriceId('stripe', id, 'year') ||
              !!getProviderPriceId('paddle', id, 'year'),
            priceCents: plan.displayPriceCents.year,
          },
        },
      };
    });

    const free = PLANS.FREE;
    const currentPlan = await getEffectivePlan(auth.user.userId, workspaceId);

    return successResponse({
      currentPlan,
      plans: [
        {
          id: free.id,
          name: free.name,
          description: free.description,
          limits: free.limits,
          intervals: {
            month: { purchasable: false, priceCents: free.displayPriceCents.month },
            year: { purchasable: false, priceCents: free.displayPriceCents.year },
          },
        },
        ...plans,
      ],
    });
  } catch (error) {
    return apiError(error, 'Failed to load plans');
  }
}
