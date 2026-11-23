// app/api/comments/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createComment, getComments } from '@/services/comment.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getMembershipForTask, canCommentWorkspace } from '@/lib/authorization';
import { apiError } from '@/utils/error-handler';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const body = await request.json();

    // IDOR+RBAC: comment-capable member (VIEWER cannot comment)
    const membership = await getMembershipForTask(String(body.task), userId);
    if (!body.task || !membership || !canCommentWorkspace(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    const comment = await createComment({
      task: body.task,
      // Never trust client-supplied user ID — use the authenticated user
      user: userId,
      text: body.text,
    });
    return successResponse(comment, 'Comment Added');
  } catch (error) {
    return apiError(error, 'Server error');
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

    const comments = await getComments(task);
    return successResponse(comments);
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
