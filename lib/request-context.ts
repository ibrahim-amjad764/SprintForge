// lib/request-context.ts
//
// Request correlation helpers. The x-request-id value is ALWAYS
// generated server-side by middleware — client-supplied values are
// overwritten and never trusted.

import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import logger from './logger';

export const REQUEST_ID_HEADER = 'x-request-id';

export function getRequestId(request: Request | NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? 'unknown';
}

export function getRequestLogger(request: Request | NextRequest) {
  return logger.child({ reqId: getRequestId(request) });
}

/**
 * Central 500 handler: structured log + Sentry report + standard
 * errorResponse shape with an additive requestId field for support
 * correlation. Does not leak internals to the client.
 */
export function serverError(
  request: Request | NextRequest,
  error: unknown,
  message = 'Internal server error'
) {
  const reqLog = getRequestLogger(request);
  reqLog.error({ err: error }, message);
  Sentry.captureException(error, {
    extra: { reqId: getRequestId(request) },
  });

  return Response.json(
    {
      success: false,
      message,
      requestId: getRequestId(request),
    },
    { status: 500 }
  );
}
