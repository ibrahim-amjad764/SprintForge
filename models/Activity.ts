// models/Activity.ts

import mongoose, { Schema, Model } from 'mongoose';

/*
 Activity History

 Example:
 Ahmed changed status
 TODO -> DONE
*/

export interface IActivity {
  task: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: string;
  message: string;
}

const ActivitySchema = new Schema<IActivity>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    action: String,
    message: String,
  },
  { timestamps: true }
);

// Activity feeds are per task, newest first.
ActivitySchema.index({ task: 1, createdAt: -1 });

const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);
export default Activity;
