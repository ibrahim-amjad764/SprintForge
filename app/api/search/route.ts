// app/api/search/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { globalSearch } from '@/services/search.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const query = request.nextUrl.searchParams.get('q');

    if (!query) {
      return successResponse({
        tasks: [],
        projects: [],
        users: [],
      });
    }

    const result = await globalSearch(query);

    return successResponse(result);
  } catch (error) {
    return errorResponse('Search failed', 500);
  }
}
