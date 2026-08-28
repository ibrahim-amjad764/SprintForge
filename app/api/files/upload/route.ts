// app/api/files/upload/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { uploadFile } from '@/services/file.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();

    const file = formData.get('file') as File;

    const user = formData.get('user') as string;

    if (!file || !user) {
      return errorResponse('File and user are required', 400);
    }

    const buffer = await file.arrayBuffer();

    const base64 = `data:${file.type};base64,${Buffer.from(buffer).toString('base64')}`;

    const result = await uploadFile(base64, user);

    return successResponse(result);
  } catch (error) {
    return errorResponse(
      'Upload failed',

      500
    );
  }
}
