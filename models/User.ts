// models/User.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
 User Model
 Stores application users.
 
 Example:
 {
   name,
   email,
   password,
   avatar,
   role
 }
*/

export interface IUser {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: 'USER' | 'ADMIN';
  tokenVersion: number;
  stripeCustomerId?: string;
  paddleCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    avatar: {
      type: String,
      default: '',
    },

    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
    },

    // Session version — embedded in JWTs and compared against the
    // database on every authenticated request. Incrementing it
    // invalidates all previously issued tokens for this user.
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // Stripe customer for user-level (personal) billing scope.
    // Workspace-scoped billing stores its customer on Workspace.
    stripeCustomerId: {
      type: String,
    },
    // Paddle customer (ctm_…) for user-level billing scope.
    paddleCustomerId: {
      type: String,
    },
  },

  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
