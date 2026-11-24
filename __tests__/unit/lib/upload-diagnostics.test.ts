import { uploadFile } from '@/lib/upload';
import logger from '@/lib/logger';

jest.mock('cloudinary', () => {
  const uploadStream = jest.fn();
  const destroy = jest.fn((_id: string, cb: (e: unknown, r: unknown) => void) => cb(null, { result: 'ok' }));
  return {
    v2: {
      config: jest.fn(),
      uploader: { upload_stream: uploadStream, destroy },
      utils: {},
    },
    __mockUploadStream: uploadStream,
  };
});

const { __mockUploadStream: mockUploadStream } = jest.requireMock('cloudinary');

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockedLogger = logger as unknown as { info: jest.Mock; error: jest.Mock };

function makeFile(name = 'test.png', type = 'image/png', content = 'x'.repeat(100)) {
  const buffer = Buffer.from(content);
  return {
    name,
    type,
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;
}

/** upload_stream mock that immediately invokes the callback. */
function respondWith(error: unknown, result?: unknown) {
  mockUploadStream.mockImplementation((_opts: unknown, cb: (e: unknown, r: unknown) => void) => {
    cb(error, result ?? null);
    return { end: jest.fn() };
  });
}

describe('uploadFile diagnostics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs cloudinary-request stage before invoking the SDK', async () => {
    respondWith(null, {
      public_id: 'p1', secure_url: 'https://res.cloudinary.com/x.png',
      width: 1, height: 1, format: 'png',
    });
    await uploadFile(makeFile());
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ values: [expect.objectContaining({ stage: 'cloudinary-request' })] }),
      expect.any(String),
    );
  });

  it('rejects and logs stage cloudinary-callback on Cloudinary Error with http_code', async () => {
    const cloudinaryError = Object.assign(new Error('Server returned unexpected status code - 403'), {
      http_code: 403,
      error: { error: 'invalid_api_key' },
    });
    respondWith(cloudinaryError);

    await expect(uploadFile(makeFile())).rejects.toBe(cloudinaryError);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'cloudinary-callback',
        outcome: 'rejected',
        name: 'Error',
        httpCode: 403,
        cloudinaryCode: 'invalid_api_key',
      }),
      expect.any(String),
    );
  });

  it('handles non-Error rejections from the SDK callback', async () => {
    respondWith({ message: 'weird rejection', http_code: 500 });
    await expect(uploadFile(makeFile())).rejects.toEqual({ message: 'weird rejection', http_code: 500 });
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'cloudinary-callback', outcome: 'rejected', isError: false }),
      expect.any(String),
    );
  });

  it('rejects with No result when callback returns neither error nor result', async () => {
    respondWith(null, null);
    await expect(uploadFile(makeFile())).rejects.toThrow('No result from Cloudinary');
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'cloudinary-callback', outcome: 'empty-result' }),
      expect.any(String),
    );
  });

  it('resolves and logs success stage on valid result', async () => {
    respondWith(null, {
      public_id: 'p1', secure_url: 'https://res.cloudinary.com/x.png',
      width: 10, height: 10, format: 'png',
    });
    const result = await uploadFile(makeFile());
    expect(result.url).toBe('https://res.cloudinary.com/x.png');
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ values: [expect.objectContaining({ stage: 'cloudinary-callback', outcome: 'success' })] }),
      expect.any(String),
    );
  });
});
