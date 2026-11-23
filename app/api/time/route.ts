// app/api/time/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { startTimer, getTaskTime } from '@/services/time.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getMembershipForTask, canWriteWorkspace } from '@/lib/authorization';
import { apiError } from '@/utils/error-handler';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const body = await request.json();

    // IDOR+RBAC: write-capable member of the workspace owning the task
    const membership = await getMembershipForTask(String(body.task), userId);
    if (!body.task || !membership || !canWriteWorkspace(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    const timer = await startTimer({
      task: body.task,
      // Never trust client-supplied user ID — use the authenticated user
      user: userId,
    });

    return successResponse(timer, 'Timer started');
  } catch (error) {
    return apiError(error, 'Timer failed');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
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

    const result = await getTaskTime(task);

    return successResponse(result);
  } catch (error) {
    return apiError(error, 'Failed');
  }
}
