// services/billing.service.ts

import stripe from '@/lib/stripe';

export async function createCheckout(
  priceId: string,

  email: string
) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',

    payment_method_types: ['card'],

    line_items: [
      {
        price: priceId,

        quantity: 1,
      },
    ],

    customer_email: email,

    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,

    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancel=true`,
  });

  return session;
}
