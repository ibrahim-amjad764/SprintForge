// app/api/admin/users/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getUsersPaginated } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';
import { rateLimit } from '@/lib/rate-limit';
import { parsePaginationParams } from '@/lib/pagination';

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

    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp);
    if ('error' in pagination) {
      return errorResponse(pagination.error, 400);
    }

    const role = sp.get('role') ?? undefined;
    const q = sp.get('q') ?? undefined;

    const result = await getUsersPaginated({ ...pagination, q, role });

    return successResponse(result);
  } catch (error) {
    return apiError(error, 'Failed to fetch users');
  }
}
