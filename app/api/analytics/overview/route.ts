// app/api/analytics/overview/route.ts
import { connectDB } from '@/lib/db';

import { getAnalytics } from '@/services/analytics.service';

import { successResponse, errorResponse } from '@/utils/response';

export async function GET() {
  try {
    await connectDB();

    const data = await getAnalytics();

    return successResponse(data);
  } catch (error) {
    return errorResponse(
      'Analytics failed',

      500
    );
  }
}
