// app/api/attachments/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { deleteAttachment } from '@/services/attachment.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function DELETE(
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
    await deleteAttachment(id);

    return successResponse(null, 'Deleted');
  } catch (error) {
    return errorResponse('Delete failed', 500);
  }
}
