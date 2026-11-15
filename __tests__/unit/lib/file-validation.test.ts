import { describe, it, expect } from '@jest/globals';
import {
  validateAttachmentFile,
  MAX_ATTACHMENT_SIZE,
} from '@/lib/file-validation';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // PK..
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function fileWithBytes(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('validateAttachmentFile', () => {
  it('rejects an empty file', async () => {
    const file = new File([], 'empty.png', { type: 'image/png' });
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('File is empty');
  });

  it('rejects files over the size limit', async () => {
    const big = new Uint8Array(MAX_ATTACHMENT_SIZE + 1);
    big.set(PNG_SIGNATURE, 0);
    const file = new File([big], 'big.png', { type: 'image/png' });
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it.each([
    'image/svg+xml',
    'text/html',
    'application/javascript',
    'application/x-msdownload',
    'application/x-sh',
    '',
  ])('rejects disallowed MIME type %s', async (type) => {
    const file = fileWithBytes(PNG_SIGNATURE, 'evil.bin', type);
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('File type is not allowed');
  });

  it('accepts a PNG with a valid signature', async () => {
    const file = fileWithBytes(
      [...PNG_SIGNATURE, 0x00, 0x00, 0x00, 0x0d],
      'photo.png',
      'image/png',
    );
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(true);
  });

  it('rejects a file whose content does not match its declared type', async () => {
    // Declared PNG but content is plain text — classic MIME spoofing
    const file = new File(['<html><script>alert(1)</script></html>'], 'fake.png', {
      type: 'image/png',
    });
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('File content does not match its declared type');
  });

  it('accepts a PDF with a valid signature', async () => {
    const file = fileWithBytes(
      [...PDF_SIGNATURE, 0x2d, 0x31, 0x2e, 0x37],
      'doc.pdf',
      'application/pdf',
    );
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(true);
  });

  it('accepts a ZIP-based document (docx) via PK signature', async () => {
    const file = fileWithBytes(
      [...ZIP_SIGNATURE, 0x14, 0x00],
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(true);
  });

  it('accepts an OLE2 office document (xls) via compound signature', async () => {
    const file = fileWithBytes(
      [...OLE2_SIGNATURE, 0x00, 0x00],
      'sheet.xls',
      'application/vnd.ms-excel',
    );
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(true);
  });

  it('accepts plain text on MIME declaration (no binary signature)', async () => {
    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
    const result = await validateAttachmentFile(file);

    expect(result.ok).toBe(true);
  });
});
