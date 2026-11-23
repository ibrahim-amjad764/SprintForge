// lib/paddle.ts
//
// Paddle Billing server client (official @paddle/paddle-node-sdk).
// Lazily initialized so tests and Stripe-only deployments never
// construct the client. Paddle is the primary provider for NEW Pro
// subscriptions; Stripe remains fully supported.
//
// Environment mapping:
//   PADDLE_ENV=production → Environment.production
//   anything else / unset → Environment.sandbox (dev-safe default;
//   production must set PADDLE_ENV=production explicitly)
//
// Never log api keys, webhook secrets, or client tokens.

import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import type { BillingProviderId } from '@/lib/billing/providers/types';

export const PADDLE_PROVIDER: BillingProviderId = 'paddle';

const PADDLE_ENV_VARS = [
  'PADDLE_ENV',
  'PADDLE_API_KEY',
  'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
  'PADDLE_PRICE_PRO_MONTHLY',
  'PADDLE_PRICE_PRO_YEARLY',
  'PADDLE_WEBHOOK_SECRET',
] as const;

export type PaddleEnvVar = (typeof PADDLE_ENV_VARS)[number];

/*
  Non-secret environment status report — which Paddle variables are
  present/absent and whether their values pass format checks.
  Returns names only; never returns values.
*/
export function getPaddleEnvStatus(): {
  configured: boolean;
  missing: PaddleEnvVar[];
  invalid: PaddleEnvVar[];
} {
  const missing: PaddleEnvVar[] = [];
  const invalid: PaddleEnvVar[] = [];

  for (const name of PADDLE_ENV_VARS) {
    if (!process.env[name]) missing.push(name);
  }

  // Price IDs must be Paddle pri_… identifiers — a price_… (Stripe)
  // or other value means misconfiguration, not a usable checkout.
  for (const name of ['PADDLE_PRICE_PRO_MONTHLY', 'PADDLE_PRICE_PRO_YEARLY'] as const) {
    const value = process.env[name];
    if (value && !value.startsWith('pri_')) invalid.push(name);
  }

  const env = process.env.PADDLE_ENV;
  if (env && env !== 'sandbox' && env !== 'production') {
    invalid.push('PADDLE_ENV');
  }

  // Webhook secret may legitimately be empty until the Paddle
  // notification destination is configured — warn via 'missing'
  // but do not mark the provider unconfigured for checkout use.
  return {
    configured: !missing.includes('PADDLE_API_KEY') && !invalid.includes('PADDLE_ENV'),
    missing,
    invalid,
  };
}

export function isPaddleConfigured(): boolean {
  return getPaddleEnvStatus().configured;
}

function paddleEnvironment(): Environment {
  return process.env.PADDLE_ENV === 'production'
    ? Environment.production
    : Environment.sandbox;
}

let paddleClient: Paddle | null = null;

/*
  Returns the shared Paddle client. Throws a clear configuration
  error when PADDLE_API_KEY is absent — callers should check
  isPaddleConfigured() first and fail closed.
*/
export function getPaddleClient(): Paddle {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error('Paddle is not configured: PADDLE_API_KEY is missing');
  }
  if (!paddleClient) {
    paddleClient = new Paddle(apiKey, { environment: paddleEnvironment() });
  }
  return paddleClient;
}

/*
  Reset the cached client — test-only hook so env changes between
  tests produce a fresh client.
*/
export function resetPaddleClientForTests(): void {
  paddleClient = null;
}
