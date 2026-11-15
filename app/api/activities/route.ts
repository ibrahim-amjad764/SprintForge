// app/api/activities/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getActivities } from '@/services/activity.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';
import { getMembershipForTask } from '@/lib/authorization';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const task = request.nextUrl.searchParams.get('task');

    if (!task) {
      return errorResponse('Task required');
    }

    // IDOR: user must be a member of the workspace owning the task
    if (!(await getMembershipForTask(task, userId))) {
      return errorResponse('Forbidden', 403);
    }

    const activities = await getActivities(task);

    return successResponse(activities);
  } catch (error) {
    return errorResponse('Server error', 500);
  }
}
