// app/api/admin/stats/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getAdminStats } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';
import { rateLimit } from '@/lib/rate-limit';

import { apiError } from '@/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    // Admin endpoints are low-traffic but DB-backed — modest per-admin cap.
    if (!rateLimit(`admin:${auth.user.userId}`, 120, 60 * 1000)) {
      return errorResponse('Too many requests', 429);
    }

    await connectDB();

    const stats = await getAdminStats();

    return successResponse(stats);
  } catch (error) {
    return apiError(error, 'Failed to fetch stats');
  }
}
