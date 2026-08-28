// app/api/upload/route.ts

import { NextRequest } from 'next/server';
import { uploadFile } from '@/lib/upload';
import { successResponse, errorResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API - request received');

    // --------------------------------------------------------
    // Parse multipart/form-data.
    //
    // apiRequest() must NOT manually set Content-Type here.
    // Browser automatically adds the multipart boundary.
    // --------------------------------------------------------

    const formData = await request.formData();

    console.log('Upload API - FormData parsed successfully');

    // --------------------------------------------------------
    // Get uploaded file.
    // --------------------------------------------------------

    const fileValue = formData.get('file');

    console.log('Upload API - file received:', {
      exists: !!fileValue,
      type: fileValue instanceof File ? fileValue.type : typeof fileValue,
      name: fileValue instanceof File ? fileValue.name : undefined,
      size: fileValue instanceof File ? fileValue.size : undefined,
    });

    // --------------------------------------------------------
    // Runtime file validation.
    //
    // `as File` alone is not enough because FormData can
    // contain a string or null.
    // --------------------------------------------------------

    if (!(fileValue instanceof File)) {
      console.error('Upload API - No valid file provided');

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
        : 'sprintforge';

    const resourceTypeValue = formData.get('resourceType');

    const validResourceTypes = ['image', 'auto', 'raw', 'video'] as const;
    const resourceType: (typeof validResourceTypes)[number] | 'image' =
      typeof resourceTypeValue === 'string' &&
      resourceTypeValue.trim() &&
      validResourceTypes.includes(resourceTypeValue.trim() as any)
        ? (resourceTypeValue.trim() as (typeof validResourceTypes)[number])
        : 'image';

    console.log('Upload API - upload options:', {
      folder,
      resourceType,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    // --------------------------------------------------------
    // Validate file size before sending it to the provider.
    //
    // This avoids unnecessary storage-provider requests.
    // --------------------------------------------------------

    const maxFileSize = 5 * 1024 * 1024; // 5MB

    if (file.size > maxFileSize) {
      console.error('❌ Upload API - file size exceeded:', {
        fileName: file.name,
        fileSize: file.size,
        maxFileSize,
      });

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
      console.error('❌ Upload API - unsupported file type:', {
        fileName: file.name,
        fileType: file.type,
      });

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

    console.log('Upload API - uploading file:', {
      fileName: file.name,
      folder,
      resourceType,
    });

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

    console.log('Upload API - file uploaded successfully:', {
      fileName: file.name,
      folder,
      resourceType,
      hasResult: !!result,
    });

    return successResponse(result, 'File uploaded successfully');
  } catch (error: unknown) {
    // --------------------------------------------------------
    // Centralized upload error handling.
    // --------------------------------------------------------

    console.error('Upload API - upload failed:', error);

    const message = error instanceof Error ? error.message : 'Upload failed';

    console.error('Upload API - error message:', message);

    return errorResponse(message, 500);
  }
}
