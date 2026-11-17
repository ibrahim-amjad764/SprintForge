// lib/logger.ts
//
// Central structured logger (Pino).
// SERVER-ONLY: do not import from client components or edge middleware —
// Pino relies on Node.js streams. Client code keeps console.*.

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  // Never let credentials or secrets reach log output.
  redact: {
    paths: [
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.secret',
      '*.apiKey',
      '*.authorization',
      '*.cookie',
      'req.headers.cookie',
      'req.headers.authorization',
      'headers.cookie',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export default logger;
