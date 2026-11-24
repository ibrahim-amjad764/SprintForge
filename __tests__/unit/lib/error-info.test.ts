import { describeError, withUploadStage, getUploadStage, uploadErrorResponse } from '@/lib/error-info';

describe('describeError', () => {
  it('normalizes a standard Error', () => {
    const info = describeError(new Error('something broke'));
    expect(info).toMatchObject({
      name: 'Error',
      message: 'something broke',
      isError: true,
    });
  });

  it('captures Error subclass name', () => {
    const info = describeError(new TypeError('bad type'));
    expect(info.name).toBe('TypeError');
    expect(info.isError).toBe(true);
  });

  it('handles cross-realm / plain-object errors with message', () => {
    const info = describeError({ message: 'boom from another realm', http_code: 403 });
    expect(info.isError).toBe(false);
    expect(info.name).toBe('object');
    expect(info.message).toBe('boom from another realm');
    expect(info.httpCode).toBe(403);
  });

  it('handles string rejections', () => {
    const info = describeError('plain string failure');
    expect(info).toMatchObject({ name: 'string', message: 'plain string failure', isError: false });
  });

  it('handles null and undefined safely', () => {
    expect(describeError(null)).toMatchObject({ name: 'null', isError: false });
    expect(describeError(undefined)).toMatchObject({ name: 'undefined', isError: false });
  });

  it('handles numbers and booleans', () => {
    expect(describeError(42).name).toBe('number');
    expect(describeError(true).name).toBe('boolean');
  });

  it('extracts Cloudinary http_code and nested error code from Error objects', () => {
    const err = Object.assign(new Error('Server returned unexpected status code - 403'), {
      http_code: 403,
      error: { error: 'invalid_api_key' },
    });
    const info = describeError(err);
    expect(info.httpCode).toBe(403);
    expect(info.cloudinaryCode).toBe('invalid_api_key');
  });

  it('extracts Cloudinary fields from plain objects', () => {
    const info = describeError({
      name: 'UnexpectedResponse',
      message: 'denied',
      http_code: 401,
      error: { error: 'unauthorized' },
    });
    expect(info.httpCode).toBe(401);
    expect(info.cloudinaryCode).toBe('unauthorized');
  });

  it('redacts secret-looking key=value pairs in messages', () => {
    const info = describeError(new Error('auth failed api_secret=abc123XYZ token:BearerXYZ'));
    expect(info.message).not.toContain('abc123XYZ');
    expect(info.message).not.toContain('BearerXYZ');
    expect(info.message).toContain('<redacted>');
  });

  it('truncates very long messages', () => {
    const info = describeError(new Error('x'.repeat(1000)));
    expect(info.message.length).toBeLessThanOrEqual(300);
  });

  it('never throws on hostile input', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => describeError(circular)).not.toThrow();
    expect(() => describeError(Symbol('x'))).not.toThrow();
  });
});

describe('withUploadStage / getUploadStage', () => {
  it('attaches and reads stage on Error objects', () => {
    const err = new Error('x');
    withUploadStage(err, 'cloudinary-callback');
    expect(getUploadStage(err)).toBe('cloudinary-callback');
    // non-enumerable — must not leak into JSON.stringify
    expect(JSON.stringify(err)).not.toContain('__uploadStage');
  });

  it('attaches stage on plain objects', () => {
    const obj = { message: 'x' };
    withUploadStage(obj, 'mongo-create');
    expect(getUploadStage(obj)).toBe('mongo-create');
  });

  it('returns undefined for primitives and unmarked values', () => {
    expect(getUploadStage('string')).toBeUndefined();
    expect(getUploadStage(new Error('plain'))).toBeUndefined();
    expect(getUploadStage(null)).toBeUndefined();
  });
});

describe('uploadErrorResponse', () => {
  it('returns sanitized diagnostics with fallback stage', async () => {
    const res = uploadErrorResponse(new Error('db exploded'), 'api-upload');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Upload failed');
    expect(body.diagnostics).toMatchObject({
      stage: 'api-upload',
      name: 'Error',
      message: 'db exploded',
      isError: true,
    });
  });

  it('prefers the attached upload stage over fallback', async () => {
    const err = Object.assign(new Error('denied'), { http_code: 403 });
    withUploadStage(err, 'cloudinary-callback');
    const res = uploadErrorResponse(err, 'api-upload');
    const body = await res.json();
    expect(body.diagnostics.stage).toBe('cloudinary-callback');
    expect(body.diagnostics.httpCode).toBe(403);
  });

  it('handles non-Error rejections', async () => {
    const res = uploadErrorResponse('weird', 'api-files-upload');
    const body = await res.json();
    expect(body.diagnostics.name).toBe('string');
    expect(body.diagnostics.message).toBe('weird');
  });
});
