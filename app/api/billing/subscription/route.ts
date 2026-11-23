// app/api/billing/subscription/route.ts
import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/session';
import { connectDB } from '@/lib/db';
import Subscription from '@/models/Subscription';
import Workspace from '@/models/Workspace';
import { successResponse, errorResponse } from '@/utils/response';
import { isPlanId } from '@/lib/plans';
import { apiError } from '@/utils/error-handler';

/*
GET /api/billing/subscription?workspaceId=

Returns the caller's subscription state for billing UI display.
For workspace scope, only the workspace owner may read billing data.
No Stripe secrets or sensitive customer fields are returned.
*/
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    if (workspaceId) {
      await connectDB();
      const ws = await Workspace.findById(workspaceId).select('owner').lean();
      if (!ws || String(ws.owner) !== String(auth.user.userId)) {
        return errorResponse('Only the workspace owner can view billing', 403);
      }
    }

    await connectDB();
    const sub = await Subscription.findOne({
      user: auth.user.userId,
      workspace: workspaceId ?? null,
    })
      .sort({ createdAt: -1 })
      .select(
        'plan interval status currentPeriodEnd trialEnd cancelAtPeriodEnd canceledAt stripeCustomerId provider providerCustomerId',
      )
      .lean();

    if (!sub) {
      return successResponse({
        plan: 'FREE',
        subscription: null,
        hasBillingAccount: false,
      });
    }

    return successResponse({
      plan: isPlanId(sub.plan) ? sub.plan : 'FREE',
      subscription: {
        status: sub.status,
        interval: sub.interval ?? null,
        currentPeriodEnd: sub.currentPeriodEnd ?? null,
        trialEnd: sub.trialEnd ?? null,
        cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt ?? null,
      },
      // Legacy docs lack `provider` ⇒ 'stripe'. Customer IDs
      // themselves are never returned — only presence. Paddle rows
      // may carry the customer ID in the legacy stripeCustomerId
      // slot, so either field counts.
      provider: sub.provider ?? 'stripe',
      hasBillingAccount: !!(sub.stripeCustomerId || sub.providerCustomerId),
    });
  } catch (error) {
    return apiError(error, 'Failed to load subscription');
  }
}
