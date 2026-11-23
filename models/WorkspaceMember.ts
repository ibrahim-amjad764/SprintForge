import mongoose, { Schema, Model } from "mongoose";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

export interface IWorkspaceMember {
  workspace: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: WorkspaceRole;
  permissions?: {
    canCreateProjects: boolean;
    canDeleteProjects: boolean;
    canInviteMembers: boolean;
    canManageSettings: boolean;
    canViewAnalytics: boolean;
  };
  invitedBy?: mongoose.Types.ObjectId;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "EDITOR", "COMMENTER", "VIEWER"],
      default: "VIEWER",
    },
    permissions: {
      canCreateProjects: { type: Boolean, default: false },
      canDeleteProjects: { type: Boolean, default: false },
      canInviteMembers: { type: Boolean, default: false },
      canManageSettings: { type: Boolean, default: false },
      canViewAnalytics: { type: Boolean, default: false },
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

WorkspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });
WorkspaceMemberSchema.index({ user: 1 });
// Paginated "my workspaces" lists sort memberships by createdAt desc.
WorkspaceMemberSchema.index({ user: 1, createdAt: -1 });

const WorkspaceMember: Model<IWorkspaceMember> =
  mongoose.models.WorkspaceMember ||
  mongoose.model<IWorkspaceMember>("WorkspaceMember", WorkspaceMemberSchema);

export default WorkspaceMember;
