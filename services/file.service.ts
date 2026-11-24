// services/file.service.ts
import cloudinary from '@/lib/cloudinary';
import File from '@/models/File';
import logger from '@/lib/logger';
import { describeError, withUploadStage } from '@/lib/error-info';

export async function uploadFile(
  file: any,
  user: string
) {
  logger.info({ stage: 'cloudinary-request', resourceType: 'auto' }, 'File service: invoking Cloudinary SDK');

  let uploaded;
  try {
    uploaded = await cloudinary.uploader.upload(
      file,

      {
        resource_type: 'auto',
      }
    );
  } catch (error) {
    logger.error({
      stage: 'cloudinary-callback',
      outcome: 'rejected',
      ...describeError(error),
    }, 'File service: Cloudinary rejected the upload');
    throw withUploadStage(error, 'cloudinary-callback');
  }

  logger.info({
    stage: 'cloudinary-callback',
    outcome: 'success',
    publicId: uploaded?.public_id,
  }, 'File service: Cloudinary upload succeeded');

  try {
    return await File.create({
      name: uploaded.original_filename,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      type: uploaded.resource_type,
      size: uploaded.bytes,
      user,
    });
  } catch (error) {
    logger.error({
      stage: 'mongo-create',
      outcome: 'rejected',
      ...describeError(error),
    }, 'File service: File.create failed after Cloudinary upload');
    throw withUploadStage(error, 'mongo-create');
  }
}

export async function deleteFile(id: string) {
  const file = await File.findById(id);

  if (!file) return null;

  await cloudinary.uploader.destroy(file.publicId);

  return File.findByIdAndDelete(id);
}
