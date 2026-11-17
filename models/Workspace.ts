import mongoose, { Schema, Model } from 'mongoose';

export interface IWorkspace {
  name: string;
  slug: string;
  description: string;
  logo?: string;
  owner: mongoose.Types.ObjectId;
  organization?: mongoose.Types.ObjectId;
  allowedDomains?: string[];
  defaultRole?: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN';
  maxMembers?: number;
  currentMembers?: number;
  tenantEncryptionKey?: string;
  dataRetentionDays?: number;
  dataRetentionScheduledAt?: Date;
  compliancePolicies?: {
    piiScanning: boolean;
    dataResidency: string;
    auditLogging: boolean;
  };
  integrations?: {
    slack?: { enabled: boolean; channelId?: string };
    teams?: { enabled: boolean; teamId?: string };
    googleCalendar?: { enabled: boolean; calendarId?: string };
    outlookCalendar?: { enabled: boolean; calendarId?: string };
    github?: { enabled: boolean; repositoryUrl?: string };
    gitlab?: { enabled: boolean; repositoryUrl?: string };
  };
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    defaultTaskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    defaultTaskStatus?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
    defaultTaskView?: 'LIST' | 'BOARD' | 'CALENDAR';
    weekStartsOn?: 'MONDAY' | 'SUNDAY';
    emailNotifications?: boolean;
    taskAssignmentNotifications?: boolean;
    dueDateReminders?: boolean;
    enableTour?: boolean;
    autoCreateRepository?: boolean;
    idpGroupMapping?: boolean;
    integrationConfig?: Record<string, any>;
  };
  parentWorkspace?: mongoose.Types.ObjectId;
  inheritedPolicies?: {
    rbac: boolean;
    compliance: boolean;
    security: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    logo: {
      type: String,
      default: '',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    allowedDomains: {
      type: [String],
      default: [],
    },
    defaultRole: {
      type: String,
      enum: ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'],
      default: 'EDITOR',
    },
    maxMembers: {
      type: Number,
      default: 50,
    },
    currentMembers: {
      type: Number,
      default: 1,
    },
    tenantEncryptionKey: {
      type: String,
    },
    dataRetentionDays: {
      type: Number,
      default: 365,
    },
    dataRetentionScheduledAt: {
      type: Date,
    },
    compliancePolicies: {
      piiScanning: { type: Boolean, default: true },
      dataResidency: { type: String, default: 'US' },
      auditLogging: { type: Boolean, default: true },
    },
    integrations: {
      slack: { enabled: Boolean, channelId: String },
      teams: { enabled: Boolean, teamId: String },
      googleCalendar: { enabled: Boolean, calendarId: String },
      outlookCalendar: { enabled: Boolean, calendarId: String },
      github: { enabled: Boolean, repositoryUrl: String },
      gitlab: { enabled: Boolean, repositoryUrl: String },
    },
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      defaultTaskPriority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM',
      },
      defaultTaskStatus: {
        type: String,
        enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
        default: 'TODO',
      },
      defaultTaskView: {
        type: String,
        enum: ['LIST', 'BOARD', 'CALENDAR'],
        default: 'LIST',
      },
      weekStartsOn: {
        type: String,
        enum: ['MONDAY', 'SUNDAY'],
        default: 'MONDAY',
      },
      emailNotifications: { type: Boolean, default: true },
      taskAssignmentNotifications: { type: Boolean, default: true },
      dueDateReminders: { type: Boolean, default: true },
      enableTour: { type: Boolean, default: false },
      autoCreateRepository: { type: Boolean, default: false },
      idpGroupMapping: { type: Boolean, default: false },
      integrationConfig: { type: Schema.Types.Mixed, default: {} },
    },
    parentWorkspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
    },
    inheritedPolicies: {
      rbac: { type: Boolean, default: false },
      compliance: { type: Boolean, default: false },
      security: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

WorkspaceSchema.index({ organization: 1 });
WorkspaceSchema.index({ owner: 1 });

const Workspace: Model<IWorkspace> =
  mongoose.models.Workspace ||
  mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
export default Workspace;
