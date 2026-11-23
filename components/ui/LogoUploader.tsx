// components/ui/LogoUploader.tsx
"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface LogoUploaderProps {
  logoUrl?: string;
  onLogoChange: (url: string) => void;
  workspaceName?: string;
  disabled?: boolean;
}

export function LogoUploader({ logoUrl, onLogoChange, workspaceName, disabled = false }: LogoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string>(logoUrl || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      // In a real implementation, you'd call your upload API
      // const response = await apiRequest('/api/upload', {
      //   method: 'POST',
      //   body: formData,
      // });

      // For demo, create a local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        onLogoChange(result);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setPreview('');
    onLogoChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = () => {
    return workspaceName?.charAt(0).toUpperCase() || 'W';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Workspace Logo</label>
      
      <div
        className={`
          relative w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-border hover:border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${preview ? 'border-solid' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Workspace logo"
              fill
              sizes="128px"
              unoptimized={!/^https?:\/\//.test(preview)}
              className="object-cover rounded-lg"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveLogo();
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/15 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">{getInitials()}</span>
            </div>
            <div className="text-center">
              {uploading ? (
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Drop or click</p>
                </>
              )}
            </div>
          </>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Recommended: Square image, max 2MB
      </p>
    </div>
  );
}
