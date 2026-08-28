// models/Subscription.ts
import mongoose, { Schema, Model } from 'mongoose';

/*

Subscription Data


Stored:

- User
- Plan
- Stripe customer
- Status


*/

export interface ISubscription {
  user: mongoose.Types.ObjectId;

  plan: string;

  stripeCustomerId: string;

  stripeSubscriptionId: string;

  status: string;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,

      ref: 'User',
    },

    plan: {
      type: String,

      default: 'FREE',
    },

    stripeCustomerId: String,

    stripeSubscriptionId: String,

    status: {
      type: String,

      default: 'ACTIVE',
    },
  },

  {
    timestamps: true,
  }
);

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>(
    'Subscription',

    SubscriptionSchema
  );

export default Subscription;
