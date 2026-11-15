// app/api/files/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import File from '@/models/File';
import { deleteFile } from '@/services/file.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';
import { getMembershipForTask, canWriteWorkspace } from '@/lib/authorization';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { id } = await params;

    // IDOR: allow the file owner, or any member of the workspace
    // that owns the related task
    const file = await File.findById(id).select('user task').lean();
    if (!file) {
      return errorResponse('Not found', 404);
    }

    const isOwner = String(file.user) === userId;
    const taskMembership = file.task
      ? await getMembershipForTask(String(file.task), userId)
      : null;

    // Non-owners need write role in the file's workspace
    const allowed =
      isOwner ||
      (taskMembership !== null && canWriteWorkspace(taskMembership.role));

    if (!allowed) {
      return errorResponse('Forbidden', 403);
    }

    const result = await deleteFile(id);

    return successResponse(result);
  } catch (error) {
    return errorResponse('Delete failed', 500);
  }
}
