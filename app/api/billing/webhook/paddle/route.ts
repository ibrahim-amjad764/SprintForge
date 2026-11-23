// app/api/billing/webhook/paddle/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handlePaddleEvent } from '@/services/billing.service';
import { unmarshalPaddleEvent } from '@/lib/billing/providers/paddle';
import { isPaddleConfigured } from '@/lib/paddle';
import logger from '@/lib/logger';

/*
POST /api/billing/webhook/paddle

Paddle webhook endpoint. Configure in Paddle Dashboard → Developer
tools → Notifications with this URL and the subscription/transaction
events SprintForge handles.

The raw body + Paddle-Signature header are verified via the official
SDK (paddle.webhooks.unmarshal — HMAC-SHA256 with the documented
5-second replay tolerance) BEFORE any payload field is read.
Unsigned/unverified payloads are rejected and never touch the DB.

Responses:
- 200: event verified and processed (or duplicate — idempotent no-op)
- 400: missing signature/secret or signature verification failed
- 500: webhook not configured or transient failure — Paddle retries
*/
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret || !isPaddleConfigured()) {
    logger.error('Paddle webhook is not configured');
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = request.headers.get('paddle-signature');
  if (!signature) {
    return new Response('Missing paddle-signature header', { status: 400 });
  }

  // Raw body — Paddle signs `${ts}:${rawBody}`; re-serialization
  // would break verification.
  const body = await request.text();

  let event;
  try {
    const normalized = await unmarshalPaddleEvent(body, signature);
    if (!normalized) {
      // Secret/header were present but unmarshal returned null —
      // defensive; treated as unverifiable.
      return new Response('Invalid signature', { status: 400 });
    }
    event = normalized;
  } catch (error) {
    logger.warn({ err: error }, 'Paddle webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await connectDB();
    const result = await handlePaddleEvent(event);
    return new Response(result === 'duplicate' ? 'duplicate' : 'received', {
      status: 200,
    });
  } catch (error) {
    // Transient failure (e.g. DB down) — 500 so Paddle retries.
    logger.error(
      { err: error, eventId: event.providerEventId, type: event.eventType },
      'Paddle webhook processing failed',
    );
    return new Response('Processing failed', { status: 500 });
  }
}
