// models/TimeEntry.ts

import mongoose, { Schema, Model } from 'mongoose';

/*
Time Entry Model
Task
 |
Time Records

Example:
Task:
Build Dashboard

Time:
2 hours 30 minutes
*/

export interface ITimeEntry {
  task: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration: number;
  createdAt: Date;
}

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: Date,

    duration: {
      type: Number,
      default: 0,
    },
  },

  { timestamps: true }
);

// Time lookups are per-task (task detail) and per-user (reports).
TimeEntrySchema.index({ task: 1 });
TimeEntrySchema.index({ user: 1 });

const TimeEntry: Model<ITimeEntry> =
  mongoose.models.TimeEntry ||
  mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);

export default TimeEntry;