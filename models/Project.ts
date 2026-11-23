import mongoose, { Schema, Model } from 'mongoose';

/*
 Project Model

 A project belongs to workspace.
 Example:
 Workspace
    |
    |
 Project
*/

export interface IProject {
  name: string;
  description?: string;
  workspace: mongoose.Types.ObjectId;
  status: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },

    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'PLANNING',
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },

  {
    timestamps: true,
  }
);

// Projects are always listed per workspace.
ProjectSchema.index({ workspace: 1 });
// Paginated project lists sort by createdAt desc within a workspace.
ProjectSchema.index({ workspace: 1, createdAt: -1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
