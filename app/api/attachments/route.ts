// app/api/attachments/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createAttachment,getAttachments } from '@/services/attachment.service';
import { successResponse, errorResponse } from '@/utils/response';
import cloudinary from '@/lib/cloudinary';
import { requireSession } from '@/lib/session';
import { validateAttachmentFile } from '@/lib/file-validation';
import { getMembershipForTask, canWriteWorkspace } from '@/lib/authorization';
import { apiError } from '@/utils/error-handler';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const formData = await request.formData();

    const file = formData.get('file');

    const task = formData.get('task') as string;

    if (!(file instanceof File)) {
      return errorResponse('File is required', 400);
    }

    // IDOR+RBAC: write-capable member of the workspace owning the task
    const membership = await getMembershipForTask(task, userId);
    if (!task || !membership || !canWriteWorkspace(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    const validation = await validateAttachmentFile(file);
    if (!validation.ok) {
      return errorResponse(validation.error || 'Invalid file', 400);
    }

    const bytes = await file.arrayBuffer();

    const buffer = Buffer.from(bytes);

    const upload = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'sprintforge' }, (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error('Cloudinary upload failed'));
          }
        })
        .end(buffer);
    });

    const attachment = await createAttachment({
      task,
      name: file.name,
      url: upload.secure_url,
      publicId: upload.public_id,
      type: file.type,
      size: file.size,
    });

    return successResponse(attachment, 'File uploaded');
  } catch (error) {
    return apiError(error, 'Upload failed');
  }
}
