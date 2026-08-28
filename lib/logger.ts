// lib/logger.ts

import pino from 'pino';

/* 
Production Logger 
Avoid console.log 
in production. 
*/

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

export default logger;
