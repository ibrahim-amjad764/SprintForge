// app/api/time/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { stopTimer } from '@/services/time.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    await connectDB();

    const { id } = await context.params;
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
