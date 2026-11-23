// utils/error-handler.ts
import logger from '@/lib/logger';
import { errorResponse } from '@/utils/response';

export function handleError(error: Error) {
  logger.error(error);

  return {
    success: false,

    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : error.message,
  };
}

/*
Standard 500 handler for API route catch blocks.

- Logs the real error server-side through Pino (secrets are
  redacted by the logger config).
- Returns a safe, route-specific client message — never leaks
  error.message or stack details to the client.
- Keeps the { success:false, message } response contract used by
  errorResponse() across all routes.
*/
export function apiError(error: unknown, message = 'Server error') {
  logger.error({ err: error }, 'API request failed');
  return errorResponse(message, 500);
}
