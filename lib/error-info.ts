// lib/error-info.ts
//
// Safe unknown-error normalization for structured logging.
//
// Goals:
// - Capture diagnostics from Error instances, cross-realm errors,
//   plain objects, strings, and non-Error rejections.
// - Never throw while inspecting an unknown value.
// - Never leak secrets: messages are truncated and any value that
//   looks like a credential is redacted.
// - Public API responses must remain generic — this util is for
//   server-side logs only.

export interface ErrorInfo {
  /** Error name, or the typeof the rejection value. */
  name: string;
  /** Sanitized message (truncated, secrets redacted). */
  message: string;
  /** True when the value is a real Error instance. */
  isError: boolean;
  /** Cloudinary-style http_code when present. */
  httpCode?: number;
  /** Cloudinary-style error.error code (e.g. "invalid_api_key"). */
  cloudinaryCode?: string;
}

const MAX_MESSAGE_LENGTH = 300;

// Keys whose values must never appear in logs.
const SECRET_KEY_PATTERN =
  /(secret|token|password|passwd|signature|api[_-]?key|auth|cookie|credential)/i;

function sanitizeString(input: string): string {
  // Redact key=value / "key":"value" style secrets embedded in messages.
  const redacted = input.replace(
    /([A-Za-z0-9_.-]*(?:secret|token|password|signature|api[_-]?key|auth|cookie)[A-Za-z0-9_.-]*)\s*[:=]\s*[^\s,;&"']+/gi,
    '$1=<redacted>',
  );
  return redacted.slice(0, MAX_MESSAGE_LENGTH);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Normalizes any thrown/rejected value into a log-safe ErrorInfo.
 * Safe to call with literally anything — never throws.
 */
export function describeError(error: unknown): ErrorInfo {
  try {
    if (error instanceof Error) {
      const record = error as unknown as Record<string, unknown>;
      return {
        name: error.name || 'Error',
        message: sanitizeString(error.message || ''),
        isError: true,
        httpCode: typeof record.http_code === 'number' ? record.http_code : undefined,
        cloudinaryCode: extractCloudinaryCode(record),
      };
    }

    // Cross-realm / non-Error objects that still carry error fields.
    const record = asRecord(error);
    if (record) {
      const message =
        typeof record.message === 'string'
          ? record.message
          : typeof record.error === 'string'
            ? record.error
            : '';
      const name =
        typeof record.name === 'string' && record.name ? record.name : 'object';
      return {
        name,
        message: sanitizeString(message),
        isError: false,
        httpCode: typeof record.http_code === 'number' ? record.http_code : undefined,
        cloudinaryCode: extractCloudinaryCode(record),
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'string',
        message: sanitizeString(error),
        isError: false,
      };
    }

    return {
      name: error === null ? 'null' : error === undefined ? 'undefined' : typeof error,
      message: '',
      isError: false,
    };
  } catch {
    // describeError must never throw — even on hostile inputs.
    return { name: 'uninspectable', message: '', isError: false };
  }
}

/**
 * Attaches a diagnostic stage marker to a thrown/rejected value so
 * route-level catch blocks can report WHERE the failure occurred.
 * Returns the same value (mutated when possible) — never throws.
 */
export function withUploadStage<T>(error: T, stage: string): T {
  try {
    if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
      Object.defineProperty(error, '__uploadStage', {
        value: stage,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // non-extensible objects — stage marker is best-effort only
  }
  return error;
}

/** Reads the stage marker set by withUploadStage, if present. */
export function getUploadStage(error: unknown): string | undefined {
  try {
    if (error !== null && typeof error === 'object') {
      const stage = (error as Record<string, unknown>).__uploadStage;
      return typeof stage === 'string' ? stage : undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * TEMPORARY diagnostic response for upload endpoints (staging only).
 * Returns sanitized describeError() fields so the failing stage can be
 * identified from the client without exposing internals.
 * REMOVE after root cause is confirmed.
 */
export function uploadErrorResponse(error: unknown, fallbackStage: string) {
  const info = describeError(error);
  const stage = getUploadStage(error) ?? fallbackStage;
  return Response.json(
    {
      success: false,
      message: 'Upload failed',
      diagnostics: {
        stage,
        name: info.name,
        message: info.message,
        ...(info.httpCode !== undefined ? { httpCode: info.httpCode } : {}),
        ...(info.cloudinaryCode ? { cloudinaryCode: info.cloudinaryCode } : {}),
        isError: info.isError,
      },
    },
    { status: 500 },
  );
}

function extractCloudinaryCode(record: Record<string, unknown>): string | undefined {
  try {
    // Cloudinary SDK errors often nest the API error under `error.error`.
    const nested = asRecord(record.error);
    if (nested && typeof nested.error === 'string') {
      return sanitizeString(nested.error).slice(0, 100);
    }
    if (typeof record.error === 'string' && SECRET_KEY_PATTERN.test(record.error) === false) {
      return sanitizeString(record.error).slice(0, 100);
    }
    return undefined;
  } catch {
    return undefined;
  }
}
