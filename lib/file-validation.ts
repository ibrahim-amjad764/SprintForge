// lib/file-validation.ts
//
// Shared file upload validation.
//
// - Enforces a size limit.
// - Enforces a MIME-type allowlist (blocks executables, HTML, SVG).
// - Verifies magic-byte signatures for binary formats so a client
//   cannot rename an arbitrary file to an allowed MIME type.
// - Text-based types (txt/csv) have no reliable signature and are
//   accepted on MIME declaration only; they cannot execute script
//   when served with a non-HTML content type.

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
]);

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

function matchesSignature(head: Uint8Array, mimeType: string): boolean {
  const startsWith = (...bytes: number[]) =>
    bytes.every((b, i) => head[i] === b);

  const ascii = (offset: number, length: number) =>
    new TextDecoder().decode(head.slice(offset, offset + length));

  switch (mimeType) {
    case 'image/jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/gif':
      return ascii(0, 4) === 'GIF8';
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
    case 'application/pdf':
      return ascii(0, 4) === '%PDF';
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06) || startsWith(0x50, 0x4b, 0x07, 0x08);
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      // OLE2 compound document signature
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    default:
      // text/plain, text/csv — no reliable binary signature
      return true;
  }
}

export async function validateAttachmentFile(
  file: File,
): Promise<FileValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: 'File is empty' };
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return {
      ok: false,
      error: `File size must be ${Math.floor(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB or less`,
    };
  }

  const mimeType = file.type?.toLowerCase() ?? '';

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: 'File type is not allowed' };
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (!matchesSignature(head, mimeType)) {
    return {
      ok: false,
      error: 'File content does not match its declared type',
    };
  }

  return { ok: true };
}
