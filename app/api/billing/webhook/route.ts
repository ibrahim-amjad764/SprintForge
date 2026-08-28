// app/api/billing/webhook/route.ts

import { NextRequest } from 'next/server';
import stripe from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const signature = request.headers.get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,

      signature,

      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    return new Response(
      'Webhook Error',

      {
        status: 400,
      }
    );
  }

  switch (event.type) {
    case 'customer.subscription.created':
      console.log('Subscription created');

      break;

    case 'customer.subscription.deleted':
      console.log('Subscription cancelled');

      break;
  }

  return new Response('received');
}
