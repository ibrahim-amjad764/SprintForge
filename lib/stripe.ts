// lib/stripe.ts
import Stripe from 'stripe';

/*

Stripe Client


Handles:

- Checkout
- Payments
- Subscriptions


*/

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default stripe;
