// components/upload/ImageUpload.tsx

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { apiRequest } from '@/lib/api';

interface ImageUploadProps {
  currentImage?: string;
  onUploadComplete: (url: string) => void;
  folder?: string;
  className?: string;
}

export default function ImageUpload({
  currentImage,
  onUploadComplete,
  folder = 'sprintforge',
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // --------------------------------------------------------
    // No file selected
    // --------------------------------------------------------

    if (!file) {
      console.log('ℹ️ Image upload cancelled');
      return;
    }

    console.log('📁 Image selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      folder,
    });

    // --------------------------------------------------------
    // Client-side file type validation.
    //
    // Server-side validation still remains mandatory.
    // This simply gives the user faster feedback.
    // --------------------------------------------------------

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Invalid image type:', file.type);

      alert('Invalid image format. Please use JPG, PNG, GIF or WEBP.');

      // Reset input so the same file can be selected again.
      e.target.value = '';

      return;
    }

    // --------------------------------------------------------
    // Client-side maximum size validation.
    //
    // Server also validates the 5MB limit.
    // --------------------------------------------------------

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      console.error('❌ Image exceeds maximum size:', {
        size: file.size,
        maxSize: maxFileSize,
      });

      alert('Image size must be 5MB or less.');

      e.target.value = '';

      return;
    }

    try {
      setUploading(true);

      // ------------------------------------------------------
      // Build multipart/form-data.
      //
      // IMPORTANT:
      // Do NOT manually set Content-Type.
      // apiRequest() handles FormData correctly.
      // ------------------------------------------------------

      const formData = new FormData();

      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('resourceType', 'image');

      console.log('📤 Starting image upload:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        folder,
      });

      // ------------------------------------------------------
      // Upload through centralized API helper.
      // ------------------------------------------------------

      const response = await apiRequest('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Upload API response:', response);

      // ------------------------------------------------------
      // Validate API response before using URL.
      //
      // Expected:
      //
      // response.data.url
      // ------------------------------------------------------

      const url = response?.data?.url;

      if (typeof url !== 'string' || !url.trim()) {
        console.error('❌ Upload succeeded but URL is missing:', response);

        throw new Error('Upload completed but image URL was not returned.');
      }

      // ------------------------------------------------------
      // Update preview immediately.
      // Parent component can then save the URL to DB.
      // ------------------------------------------------------

      setPreview(url);

      onUploadComplete(url);

      console.log('✅ Image upload completed:', {
        url,
        folder,
      });
    } catch (error) {
      console.error('❌ Image upload failed:', error);

      const message =
        error instanceof Error ? error.message : 'Failed to upload image';

      alert(message);
    } finally {
      setUploading(false);

      // Allow selecting the same file again.
      e.target.value = '';
    }
  }

  return (
    <div className={className}>
      <div className="relative h-32 w-full">
        {preview ? (
          <Image
            src={preview}
            alt="Preview"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            unoptimized={!/^https?:\/\//.test(preview)}
            className="rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}

        <label className="absolute right-2 bottom-2 cursor-pointer rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90">
          {uploading ? 'Uploading...' : 'Change'}

          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
