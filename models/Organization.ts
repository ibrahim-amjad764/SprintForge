import mongoose, { Schema, Model } from "mongoose";

export interface IOrganization {
  name: string;
  slug: string;
  logo?: string;
  owner: mongoose.Types.ObjectId;
  allowedDomains: string[];
  defaultWorkspaceSettings: {
    defaultRole: "VIEWER" | "COMMENTER" | "EDITOR" | "ADMIN";
    maxMembers: number;
    dataRetentionDays: number;
    piiScanning: boolean;
    auditLogging: boolean;
  };
  rbacPolicies: {
    roles: Array<{
      name: string;
      permissions: string[];
    }>;
    inheritance: boolean;
  };
  securityPolicies: {
    requireMFA: boolean;
    sessionTimeout: number;
    ipWhitelist: string[];
    encryptionRequired: boolean;
  };
  compliancePolicies: {
    dataResidency: string;
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
    soc2Compliant: boolean;
  };
  billing: {
    plan: "FREE" | "PRO" | "ENTERPRISE";
    maxWorkspaces: number;
    maxMembersPerWorkspace: number;
    currentWorkspaces: number;
  };
  idpSettings?: {
    provider: "OKTA" | "AZURE_AD" | "GOOGLE" | "SAML";
    domain: string;
    clientId?: string;
    groupMappingEnabled: boolean;
  };
  webhookEndpoints?: Array<{
    url: string;
    events: string[];
    secret: string;
    active: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
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
    logo: {
      type: String,
      default: "",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    allowedDomains: {
      type: [String],
      default: [],
    },
    defaultWorkspaceSettings: {
      defaultRole: {
        type: String,
        enum: ["VIEWER", "COMMENTER", "EDITOR", "ADMIN"],
        default: "EDITOR",
      },
      maxMembers: {
        type: Number,
        default: 50,
      },
      dataRetentionDays: {
        type: Number,
        default: 365,
      },
      piiScanning: {
        type: Boolean,
        default: true,
      },
      auditLogging: {
        type: Boolean,
        default: true,
      },
    },
    rbacPolicies: {
      roles: [{
        name: String,
        permissions: [String],
      }],
      inheritance: {
        type: Boolean,
        default: true,
      },
    },
    securityPolicies: {
      requireMFA: {
        type: Boolean,
        default: false,
      },
      sessionTimeout: {
        type: Number,
        default: 86400, // 24 hours in seconds
      },
      ipWhitelist: {
        type: [String],
        default: [],
      },
      encryptionRequired: {
        type: Boolean,
        default: true,
      },
    },
    compliancePolicies: {
      dataResidency: {
        type: String,
        default: "US",
      },
      gdprCompliant: {
        type: Boolean,
        default: false,
      },
      hipaaCompliant: {
        type: Boolean,
        default: false,
      },
      soc2Compliant: {
        type: Boolean,
        default: false,
      },
    },
    billing: {
      plan: {
        type: String,
        enum: ["FREE", "PRO", "ENTERPRISE"],
        default: "FREE",
      },
      maxWorkspaces: {
        type: Number,
        default: 5,
      },
      maxMembersPerWorkspace: {
        type: Number,
        default: 50,
      },
      currentWorkspaces: {
        type: Number,
        default: 0,
      },
    },
    idpSettings: {
      provider: {
        type: String,
        enum: ["OKTA", "AZURE_AD", "GOOGLE", "SAML"],
      },
      domain: String,
      clientId: String,
      groupMappingEnabled: {
        type: Boolean,
        default: false,
      },
    },
    webhookEndpoints: [{
      url: String,
      events: [String],
      secret: String,
      active: {
        type: Boolean,
        default: true,
      },
    }],
  },
  {
    timestamps: true,
  },
);

OrganizationSchema.index({ owner: 1 });
OrganizationSchema.index({ "idpSettings.domain": 1 });

const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);

export default Organization;
