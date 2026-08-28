import mongoose, { Schema, Model } from "mongoose";

/*
 Team Model

 A team belongs to a workspace.

 Example:

 Workspace
    |
    |
    Team

*/

export interface ITeamMember {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'designer' | 'project_manager' | 'viewer';
  avatar?: string;
}

export interface ITeam {
  name: string;
  avatar?: string;
  workspace: mongoose.Types.ObjectId;
  description?: string;
  members: ITeamMember[];
  color?: string;
  totalTasksCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    members: {
      type: [{
        _id: { type: Schema.Types.ObjectId, auto: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String, enum: ['admin', 'developer', 'designer', 'project_manager', 'viewer'], default: 'developer' },
        avatar: { type: String, default: '' },
      }],
      default: [],
    },

    color: {
      type: String,
      default: null,
    },

    totalTasksCount: {
      type: Number,
      default: 0,
    },
  },

  {
    timestamps: true,
  },
);

const Team: Model<ITeam> =  mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);

export default Team;
