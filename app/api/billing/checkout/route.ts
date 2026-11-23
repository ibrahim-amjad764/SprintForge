// app/api/billing/checkout/route.ts
import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/session';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { createCheckoutSession } from '@/services/billing.service';
import { successResponse, errorResponse } from '@/utils/response';
import { apiError } from '@/utils/error-handler';

/*
POST /api/billing/checkout
Body: { plan: 'PRO'|'TEAM', interval: 'month'|'year', workspaceId? }

Plan/interval are validated server-side against the catalog; the
Stripe Price ID is resolved from env — clients never send price IDs.
workspaceId is optional: omit for a user-level subscription, supply
for workspace-level billing (owner-only, enforced in the service).
*/
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => null);
    const plan = typeof body?.plan === 'string' ? body.plan : '';
    const interval = typeof body?.interval === 'string' ? body.interval : '';
    const workspaceId =
      typeof body?.workspaceId === 'string' && body.workspaceId
        ? body.workspaceId
        : null;
    const returnTo =
      typeof body?.returnTo === 'string' ? body.returnTo : null;
    const provider =
      body?.provider === 'paddle' || body?.provider === 'stripe'
        ? body.provider
        : 'stripe';

    await connectDB();
    const user = await User.findById(auth.user.userId)
      .select('email')
      .lean();
    if (!user?.email) {
      return errorResponse('User email not found', 400);
    }

    const result = await createCheckoutSession({
      userId: auth.user.userId,
      userEmail: user.email,
      plan,
      interval,
      workspaceId,
      returnTo,
      provider,
    });

    if (!result.ok) {
      return errorResponse(result.error, result.status);
    }
    /*
      Stripe returns a redirect URL; Paddle returns a checkout config
      the client feeds to Paddle.Checkout.open() — no server-side
      session exists for Paddle.
    */
    if ('paddleCheckout' in result.data) {
      return successResponse({
        provider: 'paddle',
        paddleCheckout: result.data.paddleCheckout,
      });
    }
    return successResponse({ url: result.data.url });
  } catch (error) {
    return apiError(error, 'Checkout failed');
  }
}
