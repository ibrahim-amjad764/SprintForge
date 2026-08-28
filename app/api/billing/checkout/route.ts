// app/api/billing/checkout/route.ts
import { NextRequest } from 'next/server';

import { createCheckout } from '@/services/billing.service';

import { successResponse, errorResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const session = await createCheckout(
      body.priceId,

      body.email
    );

    return successResponse(session);
  } catch (error) {
    return errorResponse(
      'Checkout failed',

      500
    );
  }
}
