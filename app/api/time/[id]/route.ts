// app/api/time/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { stopTimer } from '@/services/time.service';
import TimeEntry from '@/models/TimeEntry';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { id } = await context.params;

    // IDOR: a user may only stop their own timer entries
    const entry = await TimeEntry.findById(id).select('user').lean();
    if (!entry || String(entry.user) !== userId) {
      return errorResponse('Forbidden', 403);
    }

    const result = await stopTimer(id);

    return successResponse(
      result,
      'Timer stopped'
    );
  } catch (error) {
    return errorResponse(
      'Failed',
      500
    );
  }
}
