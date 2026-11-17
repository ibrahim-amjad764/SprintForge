// app/api/billing/checkout/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { createCheckout } from '@/services/billing.service';

import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const body = await request.json();

    // Never trust client-supplied email — use the authenticated user's
    const user = await User.findById(userId).select('email').lean();
    if (!user?.email) {
      return errorResponse('User email not found', 400);
    }

    const session = await createCheckout(
      body.priceId,

      user.email
    );

    return successResponse(session);
  } catch (error) {
    return errorResponse(
      'Checkout failed',

      500
    );
  }
}
