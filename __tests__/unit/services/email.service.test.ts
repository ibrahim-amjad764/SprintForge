import resend from '@/lib/email';
import * as Sentry from '@sentry/nextjs';
import logger from '@/lib/logger';
import { sendEmail } from '@/services/email.service';

jest.mock('@/lib/email', () => ({
  __esModule: true,
  default: { emails: { send: jest.fn() } },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    flush: jest.fn(),
  },
}));

const mockSend = resend.emails.send as jest.Mock;
const mockCapture = Sentry.captureException as jest.Mock;
const mockWarn = logger.warn as jest.Mock;
const mockError = logger.error as jest.Mock;

const PAYLOAD = { to: 'user@example.com', subject: 'Hi', html: '<p>secret body</p>' };

function okResponse() {
  return { data: { id: 'email_123' }, error: null, headers: null };
}

function errResponse(statusCode: number | null, name = 'application_error') {
  return {
    data: null,
    error: { name, statusCode, message: 'provider said no' },
    headers: null,
  };
}

async function flushDelays() {
  // sendEmail awaits setTimeout between attempts — advance fake timers
  // until the returned promise settles.
  for (let i = 0; i < 10; i++) {
    await jest.advanceTimersByTimeAsync(10_000);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  delete process.env.EMAIL_MAX_RETRIES;
  process.env.EMAIL_FROM = 'test@example.com';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('sendEmail retries', () => {
  it('succeeds on the first attempt without retrying', async () => {
    mockSend.mockResolvedValue(okResponse());

    const promise = sendEmail(PAYLOAD);
    await flushDelays();
    const result = await promise;

    expect(result.data).toEqual({ id: 'email_123' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('sends a stable idempotency key across retries', async () => {
    mockSend
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(okResponse());

    const promise = sendEmail(PAYLOAD);
    await flushDelays();
    await promise;

    expect(mockSend).toHaveBeenCalledTimes(2);
    const key1 = mockSend.mock.calls[0][1].idempotencyKey;
    const key2 = mockSend.mock.calls[1][1].idempotencyKey;
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2);
  });

  it('retries transient 429/5xx and succeeds', async () => {
    mockSend
      .mockResolvedValueOnce(errResponse(429, 'rate_limit_exceeded'))
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse());

    const promise = sendEmail(PAYLOAD);
    await flushDelays();
    const result = await promise;

    expect(result.data).toEqual({ id: 'email_123' });
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockWarn).toHaveBeenCalledTimes(2);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('retries network errors (statusCode null)', async () => {
    mockSend
      .mockResolvedValueOnce(errResponse(null))
      .mockResolvedValueOnce(okResponse());

    const promise = sendEmail(PAYLOAD);
    await flushDelays();
    await promise;

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent 4xx errors', async () => {
    mockSend.mockResolvedValue(errResponse(400, 'validation_error'));

    const promise = sendEmail(PAYLOAD);
    const assertion = expect(promise).rejects.toThrow('Email delivery failed after 1 attempt');
    await flushDelays();
    await assertion;

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, toDomain: 'example.com' }),
      'Email send failed permanently'
    );
  });

  it('exhausts retries on persistent transient failure and reports to Sentry', async () => {
    mockSend.mockResolvedValue(errResponse(500));

    const promise = sendEmail(PAYLOAD);
    const assertion = expect(promise).rejects.toThrow('Email delivery failed after 3 attempt(s)');
    await flushDelays();
    await assertion;

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockWarn).toHaveBeenCalledTimes(2);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 3, statusCode: 500 }),
      'Email send failed permanently'
    );
  });

  it('honors EMAIL_MAX_RETRIES env override', async () => {
    process.env.EMAIL_MAX_RETRIES = '2';
    mockSend.mockResolvedValue(errResponse(500));

    const promise = sendEmail(PAYLOAD);
    const assertion = expect(promise).rejects.toThrow('after 2 attempt(s)');
    await flushDelays();
    await assertion;

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('clamps invalid EMAIL_MAX_RETRIES to the safe default', async () => {
    process.env.EMAIL_MAX_RETRIES = 'not-a-number';
    mockSend.mockResolvedValue(errResponse(500));

    const promise = sendEmail(PAYLOAD);
    const assertion = expect(promise).rejects.toThrow('after 3 attempt(s)');
    await flushDelays();
    await assertion;

    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('never leaks recipient, subject, or html into logs or thrown error', async () => {
    mockSend.mockResolvedValue(errResponse(500));

    const promise = sendEmail({
      to: 'jane.doe@private.example',
      subject: 'Secret Project Falcon',
      html: '<p>top secret body</p>',
    });
    const assertion = expect(promise).rejects.toThrow();
    await flushDelays();
    await assertion;

    const logged = JSON.stringify([...mockWarn.mock.calls, ...mockError.mock.calls]);
    expect(logged).not.toContain('jane.doe');
    expect(logged).not.toContain('Secret Project Falcon');
    expect(logged).not.toContain('top secret body');
    expect(logged).toContain('private.example'); // domain only is OK
  });
});
