// app/api/files/upload/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { uploadFile } from '@/services/file.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { validateAttachmentFile } from '@/lib/file-validation';
import { apiError } from '@/utils/error-handler';
import { describeError } from '@/lib/error-info';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const formData = await request.formData();

    const file = formData.get('file') as File;

    // The `user` form field is ignored — identity comes from the JWT
    if (!file) {
      return errorResponse('File is required', 400);
    }

    const validation = await validateAttachmentFile(file);
    if (!validation.ok) {
      return errorResponse(validation.error || 'Invalid file', 400);
    }

    const buffer = await file.arrayBuffer();

    const base64 = `data:${file.type};base64,${Buffer.from(buffer).toString('base64')}`;

    const result = await uploadFile(base64, userId);

    return successResponse(result);
  } catch (error) {
    logger.error({
      stage: 'api-files-upload',
      ...describeError(error),
    }, 'Files upload API - upload failed:');
    return apiError(error, 'Upload failed');
  }
}
