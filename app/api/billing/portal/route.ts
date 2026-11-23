// app/api/billing/portal/route.ts
import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/session';
import { createPortalSession } from '@/services/billing.service';
import { successResponse, errorResponse } from '@/utils/response';
import { apiError } from '@/utils/error-handler';

/*
POST /api/billing/portal
Body: { workspaceId? }

Creates a Stripe Customer Portal session for subscription
management (payment method, cancellation, invoices). Owner-only
for workspace scope — enforced in the service.
*/
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === 'string' && body.workspaceId
        ? body.workspaceId
        : null;

    const result = await createPortalSession({
      userId: auth.user.userId,
      workspaceId,
    });

    if (!result.ok) {
      return errorResponse(result.error, result.status);
    }
    return successResponse({ url: result.data.url });
  } catch (error) {
    return apiError(error, 'Failed to create portal session');
  }
}
