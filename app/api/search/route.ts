// app/api/search/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { globalSearch } from '@/services/search.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const query = request.nextUrl.searchParams.get('q');

    if (!query) {
      return successResponse({
        tasks: [],
        projects: [],
        users: [],
      });
    }

    const result = await globalSearch(query, userId);

    return successResponse(result);
  } catch (error) {
    return errorResponse('Search failed', 500);
  }
}
