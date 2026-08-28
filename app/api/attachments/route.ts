// app/api/attachments/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createAttachment,getAttachments } from '@/services/attachment.service';
import { successResponse, errorResponse } from '@/utils/response';
import cloudinary from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();

    const file: any = formData.get('file');

    const task = formData.get('task') as string;

    const bytes = await file.arrayBuffer();

    const buffer = Buffer.from(bytes);

    const upload: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'sprintforge' }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
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
    return errorResponse('Upload failed', 500);
  }
}
