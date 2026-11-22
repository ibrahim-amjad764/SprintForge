// lib/stripe.ts
import Stripe from 'stripe';

/*

Stripe Client


Handles:

- Checkout
- Payments
- Subscriptions


Lazily initialized — the client is only constructed on first use so
that builds and Paddle-only deployments never require
STRIPE_SECRET_KEY. Accessing any Stripe API without the key throws a
clear configuration error at call time.

*/

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing');
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default stripe;
