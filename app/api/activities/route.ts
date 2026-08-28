// app/api/activities/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getActivities } from '@/services/activity.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const task = request.nextUrl.searchParams.get('task');
    const activities = await getActivities(task!);

    return successResponse(activities);
  } catch (error) {
    return errorResponse('Server error', 500);
  }
}
