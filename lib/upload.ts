// lib/upload.ts
import { v2 as cloudinary } from 'cloudinary';
import logger from '@/lib/logger';
import { describeError, withUploadStage } from '@/lib/error-info';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

export interface UploadOptions {
  folder?: string;
  transformation?: any;
  resourceType?: 'image' | 'auto' | 'raw' | 'video';
  maxFileSize?: number;
  allowedFormats?: string[];
}

export async function uploadFile(
  file: File | Buffer | string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    folder = process.env.CLOUDINARY_FOLDER || 'sprintforge',
    transformation,
    resourceType = 'image',
    maxFileSize = 5 * 1024 * 1024, // 5MB default
    allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  } = options;

  logger.info({ values: [{
    fileName: file instanceof File ? file.name : 'buffer/string',
    fileSize: file instanceof File ? file.size : 'N/A',
    fileType: file instanceof File ? file.type : 'N/A',
  }] }, '📤 Upload file input:');

  // Convert File to Buffer if needed
  let buffer: Buffer;
  
  if (file instanceof File) {
    logger.info('📤 Converting File to Buffer...');
    
    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(`File size exceeds maximum of ${maxFileSize / 1024 / 1024}MB`);
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && !allowedFormats.includes(extension)) {
      throw new Error(`File type not allowed. Allowed: ${allowedFormats.join(', ')}`);
    }

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    
    logger.info('✅ File converted to Buffer successfully');
    logger.info({ values: [file.name] }, 'File:');
    logger.info({ values: [file.size] }, 'Size:');
    logger.info({ values: [buffer.length] }, 'Buffer size:');
  } else if (typeof file === 'string') {
    logger.info('📤 Converting string to Buffer...');
    buffer = Buffer.from(file);
    logger.info('✅ String converted to Buffer successfully');
    logger.info({ values: [buffer.length] }, 'Buffer size:');
  } else {
    logger.info('📤 Using existing Buffer...');
    buffer = file as Buffer;
    logger.info({ values: [buffer.length] }, 'Buffer size:');
  }

  return new Promise((resolve, reject) => {
    logger.info({ values: [{
      stage: 'cloudinary-request',
      folder,
      resourceType,
      bytes: buffer.length,
    }] }, '📤 Upload: invoking Cloudinary SDK');

    cloudinary.uploader.upload_stream(
      {
        folder,
        transformation,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          logger.error({
            stage: 'cloudinary-callback',
            outcome: 'rejected',
            ...describeError(error),
          }, '❌ Upload: Cloudinary rejected the upload');
          reject(withUploadStage(error, 'cloudinary-callback'));
        } else if (result) {
          logger.info({ values: [{
            stage: 'cloudinary-callback',
            outcome: 'success',
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
          }] }, '✅ Cloudinary upload successful:');
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width || 0,
            height: result.height || 0,
            format: result.format || '',
          });
        } else {
          logger.error({
            stage: 'cloudinary-callback',
            outcome: 'empty-result',
          }, '❌ Upload: Cloudinary returned no result');
          reject(withUploadStage(new Error('Upload failed: No result from Cloudinary'), 'cloudinary-callback'));
        }
      }
    ).end(buffer);
  });
}

export async function deleteFile(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function uploadBase64(
  base64String: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  return uploadFile(buffer, options);
}
