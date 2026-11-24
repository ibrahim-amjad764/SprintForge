// app/api/upload/route.ts

import { NextRequest } from 'next/server';
import { uploadFile } from '@/lib/upload';
import { describeError } from '@/lib/error-info';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;

    logger.info('Upload API - request received');

    // --------------------------------------------------------
    // Parse multipart/form-data.
    //
    // apiRequest() must NOT manually set Content-Type here.
    // Browser automatically adds the multipart boundary.
    // --------------------------------------------------------

    const formData = await request.formData();

    logger.info('Upload API - FormData parsed successfully');

    // --------------------------------------------------------
    // Get uploaded file.
    // --------------------------------------------------------

    const fileValue = formData.get('file');

    logger.info({ values: [{
      exists: !!fileValue,
      type: fileValue instanceof File ? fileValue.type : typeof fileValue,
      name: fileValue instanceof File ? fileValue.name : undefined,
      size: fileValue instanceof File ? fileValue.size : undefined,
    }] }, 'Upload API - file received:');

    // --------------------------------------------------------
    // Runtime file validation.
    //
    // `as File` alone is not enough because FormData can
    // contain a string or null.
    // --------------------------------------------------------

    if (!(fileValue instanceof File)) {
      logger.error('Upload API - No valid file provided');

      return errorResponse('No valid file provided', 400);
    }

    const file = fileValue;

    // --------------------------------------------------------
    // Get upload options.
    // --------------------------------------------------------

    const folderValue = formData.get('folder');

    const folder =
      typeof folderValue === 'string' && folderValue.trim()
        ? folderValue.trim()
        : process.env.CLOUDINARY_FOLDER || 'sprintforge';

    const resourceTypeValue = formData.get('resourceType');

    const validResourceTypes = ['image', 'auto', 'raw', 'video'] as const;
    const resourceType: (typeof validResourceTypes)[number] | 'image' =
      typeof resourceTypeValue === 'string' &&
      resourceTypeValue.trim() &&
      validResourceTypes.includes(resourceTypeValue.trim() as (typeof validResourceTypes)[number])
        ? (resourceTypeValue.trim() as (typeof validResourceTypes)[number])
        : 'image';

    logger.info({ values: [{
      folder,
      resourceType,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }] }, 'Upload API - upload options:');

    // --------------------------------------------------------
    // Validate file size before sending it to the provider.
    //
    // This avoids unnecessary storage-provider requests.
    // --------------------------------------------------------

    const maxFileSize = 5 * 1024 * 1024; // 5MB

    if (file.size > maxFileSize) {
      logger.error({ values: [{
        fileName: file.name,
        fileSize: file.size,
        maxFileSize,
      }] }, '❌ Upload API - file size exceeded:');

      return errorResponse('File size must be 5MB or less', 400);
    }

    // --------------------------------------------------------
    // Validate MIME type.
    //
    // The uploadFile() helper also receives allowedFormats,
    // but rejecting obviously invalid files here gives a
    // cleaner API error.
    // --------------------------------------------------------

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      logger.error({ values: [{
        fileName: file.name,
        fileType: file.type,
      }] }, '❌ Upload API - unsupported file type:');

      return errorResponse(
        'Unsupported image format. Allowed formats: JPG, JPEG, PNG, GIF, WEBP',
        400
      );
    }

    // --------------------------------------------------------
    // Upload file to configured storage provider.
    //
    // Existing uploadFile() functionality is preserved.
    // --------------------------------------------------------

    logger.info({ values: [{
      fileName: file.name,
      folder,
      resourceType,
    }] }, 'Upload API - uploading file:');

    const result = await uploadFile(file, {
      folder,
      resourceType,
      maxFileSize,
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    });

    // --------------------------------------------------------
    // Log provider result.
    //
    // Do not log the complete result if your provider
    // response contains sensitive credentials.
    // --------------------------------------------------------

    logger.info({ values: [{
      fileName: file.name,
      folder,
      resourceType,
      hasResult: !!result,
    }] }, 'Upload API - file uploaded successfully:');

    return successResponse(result, 'File uploaded successfully');
  } catch (error: unknown) {
    // --------------------------------------------------------
    // Centralized upload error handling.
    // --------------------------------------------------------

    logger.error({
      stage: 'api-upload',
      ...describeError(error),
    }, 'Upload API - upload failed:');

    // Public response stays generic — diagnostics live in logs only.
    return errorResponse('Upload failed', 500);
  }
}
