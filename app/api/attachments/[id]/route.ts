// app/api/attachments/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import Attachment from '@/models/Attachment';
import { deleteAttachment } from '@/services/attachment.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';
import { getMembershipForTask, canWriteWorkspace } from '@/lib/authorization';

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { id } = await context.params;

    // IDOR: resolve attachment -> task -> workspace and verify membership
    const attachment = await Attachment.findById(id).select('task').lean();
    if (!attachment) {
      return errorResponse('Not found', 404);
    }

    // IDOR+RBAC: write-capable member of the attachment's workspace
    const membership = await getMembershipForTask(
      String(attachment.task),
      userId,
    );
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    await deleteAttachment(id);

    return successResponse(null, 'Deleted');
  } catch (error) {
    return errorResponse('Delete failed', 500);
  }
}
