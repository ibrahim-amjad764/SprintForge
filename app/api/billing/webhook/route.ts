// app/api/billing/webhook/route.ts
import { NextRequest } from 'next/server';
import stripe from '@/lib/stripe';
import { connectDB } from '@/lib/db';
import { handleStripeEvent } from '@/services/billing.service';
import logger from '@/lib/logger';

/*
POST /api/billing/webhook

Stripe webhook endpoint. The raw body + stripe-signature header are
verified BEFORE any payload field is read — unsigned/unverified
payloads are rejected with 400 and never touch the database.

Responses:
- 200: event verified and processed (or duplicate — idempotent no-op)
- 400: missing signature/secret or signature verification failed
- 500: transient failure — Stripe will retry delivery
*/
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    logger.warn({ err: error }, 'Stripe webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await connectDB();
    const result = await handleStripeEvent(event);
    return new Response(result === 'duplicate' ? 'duplicate' : 'received', {
      status: 200,
    });
  } catch (error) {
    // Transient failure (e.g. DB down) — 500 so Stripe retries.
    logger.error({ err: error, eventId: event.id, type: event.type }, 'Webhook processing failed');
    return new Response('Processing failed', { status: 500 });
  }
}
