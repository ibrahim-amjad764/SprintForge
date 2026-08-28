// models/Notification.ts

import mongoose, { Schema, Model } from 'mongoose';

/*
  Notification Model

  Stores:
  - Task alerts
  - Comments
  - Mentions
  - Invitations

  Examples:
  - Ahmed assigned you a task
  - Sara commented on your task
*/

export interface INotification {
  user: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      default: 'GENERAL', // TASK, COMMENT, MENTION, INVITATION, etc.
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    link: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
