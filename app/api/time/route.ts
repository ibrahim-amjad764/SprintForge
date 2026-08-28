// app/api/time/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { startTimer, getTaskTime } from '@/services/time.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    const timer = await startTimer({
      task: body.task,
      user: body.user,
    });

    return successResponse(timer, 'Timer started');
  } catch (error) {
    return errorResponse('Timer failed', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const task = request.nextUrl.searchParams.get('task');

    const result = await getTaskTime(task!);

    return successResponse(result);
  } catch (error) {
    return errorResponse(
      'Failed',

      500
    );
  }
}