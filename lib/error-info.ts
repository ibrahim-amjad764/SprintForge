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
