// app/api/search/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { globalSearch } from '@/services/search.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/utils/error-handler';

// Search fans out to 5+ queries incl. regex scans — throttle per user.
const SEARCH_RATE_LIMIT = 60;
const SEARCH_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    if (!rateLimit(`search:${userId}`, SEARCH_RATE_LIMIT, SEARCH_WINDOW_MS)) {
      return errorResponse('Too many requests — please try again later', 429);
    }

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
    return apiError(error, 'Search failed');
  }
}
