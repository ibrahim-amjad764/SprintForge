// models/AuditLog.ts

import mongoose, { Schema, Model } from 'mongoose';

/*
Audit History

Examples:
Admin deleted user
Admin updated settings
*/

export interface IAuditLog {
  user: mongoose.Types.ObjectId;
  action: string;
  target: string;
  description: string;
}

const AuditSchema = new Schema<IAuditLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    action: String,
    target: String,
    description: String,
  },

  {
    timestamps: true,
  }
);

// Admin log view sorts all entries newest-first.
AuditSchema.index({ createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditSchema);

export default AuditLog;
