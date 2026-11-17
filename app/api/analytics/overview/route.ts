// app/api/analytics/overview/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';

import { getAnalytics } from '@/services/analytics.service';

import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const data = await getAnalytics(userId);

    return successResponse(data);
  } catch (error) {
    return errorResponse(
      'Analytics failed',

      500
    );
  }
}
