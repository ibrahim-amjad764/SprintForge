// utils/error-handler.ts
import logger from '@/lib/logger';

export function handleError(error: any) {
  logger.error(error);

  return {
    success: false,

    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : error.message,
  };
}
