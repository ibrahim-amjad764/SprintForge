// services/email.service.ts

import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import resend from '@/lib/email';
import logger from '@/lib/logger';

/*
Central Email Service
Instead of writing email logic
everywhere:
auth
tasks
workspace
all call this service.

Reliability:
- Bounded retries (EMAIL_MAX_RETRIES, default 3 attempts) with
  exponential backoff — transient failures only.
- Transient = network/unreachable (statusCode null), HTTP 429,
  HTTP 5xx. Permanent 4xx fails fast.
- One idempotency key per logical email, reused across retries,
  so Resend dedupes if a "failed" attempt actually delivered.
- Final failures are logged (Pino, sanitized) and reported to
  Sentry, then thrown — callers' existing catch paths handle it.
- NEVER log html bodies, subjects, or full recipient addresses.
*/

const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS_LIMIT = 10;
const BASE_DELAY_MS = 500;
const BACKOFF_FACTOR = 4;

function maxAttempts(): number {
  const raw = Number(process.env.EMAIL_MAX_RETRIES);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX_ATTEMPTS;
  return Math.min(Math.floor(raw), MAX_ATTEMPTS_LIMIT);
}

// Resend SDK never throws — it resolves { data, error }. A null
// statusCode means the request never got an HTTP response
// (DNS/TCP/TLS failure) → transient.
function isTransient(error: { statusCode: number | null }): boolean {
  const status = error.statusCode;
  if (status == null) return true;
  return status === 429 || status >= 500;
}

// Recipient domain only — the local part is PII and stays out of logs.
function toDomain(to: string): string {
  const at = to.lastIndexOf('@');
  return at === -1 ? 'unknown' : to.slice(at + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const attempts = maxAttempts();
  // Stable across retries → provider-side dedupe of double delivery.
  const idempotencyKey = `email-${randomUUID()}`;
  const domain = toDomain(to);

  let lastError: { name?: string; statusCode: number | null; message?: string } | null = null;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    attemptsMade = attempt;
    const result = await resend.emails.send(
      {
        from: process.env.EMAIL_FROM!,
        to,
        subject,
        html,
      },
      { idempotencyKey }
    );

    if (!result.error) {
      return result;
    }

    lastError = result.error;
    const transient = isTransient(result.error);

    if (!transient || attempt === attempts) {
      break;
    }

    const delayMs = BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
    logger.warn(
      {
        attempt,
        maxAttempts: attempts,
        delayMs,
        statusCode: result.error.statusCode,
        errorName: result.error.name,
        toDomain: domain,
      },
      'Email send failed — retrying'
    );
    await sleep(delayMs);
  }

  // Sanitized error: no recipient, subject, or body content.
  const err = new Error(
    `Email delivery failed after ${attemptsMade} attempt(s) ` +
      `(${lastError?.name ?? 'unknown_error'}, status ${lastError?.statusCode ?? 'network'})`
  );
  logger.error(
    {
      err,
      attempts: attemptsMade,
      maxAttempts: attempts,
      statusCode: lastError?.statusCode ?? null,
      errorName: lastError?.name ?? 'unknown_error',
      toDomain: domain,
    },
    'Email send failed permanently'
  );
  Sentry.captureException(err);
  throw err;
}
