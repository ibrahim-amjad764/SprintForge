// app/api/comments/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createComment, getComments } from '@/services/comment.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const comment = await createComment({
      task: body.task,
      user: body.user,
      text: body.text,
    });
    return successResponse(comment, 'Comment Added');
  } catch (error) {
    return errorResponse('Server error', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const task = request.nextUrl.searchParams.get('task');
    const comments = await getComments(task!);
    return successResponse(comments);
  } catch (error) {
    return errorResponse('Server error', 500);
  }
}
