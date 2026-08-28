// models/Task.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
 Task Model
 Every task belongs to a project.

 Example:
 Project

    |
    |
 Task

*/

export interface ITask {
  title: string;
  description?: string;
  project: mongoose.Types.ObjectId;
  assignee?: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  status: string;
  priority: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },

    assignee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },

    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'],
      default: 'TODO',
    },

    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },

    dueDate: Date,
  },

  { timestamps: true }
);

const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;
