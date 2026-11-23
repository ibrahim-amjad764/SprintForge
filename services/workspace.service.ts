// services/workspace.service.ts

import Workspace from '@/models/Workspace';
import WorkspaceMember, {
  WorkspaceRole,
} from '@/models/WorkspaceMember';
import Organization from '@/models/Organization';
import mongoose from 'mongoose';
import crypto from 'crypto';
import logger from '@/lib/logger';
import { getEffectivePlan, assertPlanLimit, PlanLimitError } from '@/services/billing.service';
import { limitsForPlan } from '@/lib/plans';

/*
  Workspace Service Layer

  Purpose:
  - Contains all workspace database operations.
  - API routes should call this service instead of directly
    communicating with MongoDB.
  - Keeps business logic centralized and reusable.
*/

// ============================================================
// DOMAIN VALIDATION
// ============================================================

export function validateEmailDomain(
  email: string,
  allowedDomains: string[]
): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();

  return allowedDomains.some(
    (domain) => emailDomain === domain.toLowerCase()
  );
}

// ============================================================
// UNIQUE SLUG GENERATOR
// ============================================================

export async function generateUniqueSlug(
  baseSlug: string
): Promise<string> {
  const WorkspaceModel = (
    await import('@/models/Workspace')
  ).default;

  const existing = await WorkspaceModel.findOne({
    slug: baseSlug,
  });

  if (!existing) {
    logger.info({ values: [baseSlug] }, 'Workspace slug available:');

    return baseSlug;
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random()
    .toString(36)
    .substring(2, 5);

  const alternatives = [
    `${baseSlug}-${timestamp}`,
    `${baseSlug}-${random}`,
    `${baseSlug}-${timestamp}-${random}`,
  ];

  for (const alt of alternatives) {
    const exists = await WorkspaceModel.findOne({
      slug: alt,
    });

    if (!exists) {
      logger.info({ values: [alt] }, 'Generated unique workspace slug:');

      return alt;
    }
  }

  const fallbackSlug = `${baseSlug}-${Date.now()}`;

  logger.info({ values: [fallbackSlug] }, 'Using fallback workspace slug:');

  return fallbackSlug;
}

// ============================================================
// TENANT ENCRYPTION KEY
// ============================================================

export function generateTenantKey(): string {
  logger.info('Generating tenant encryption key');

  return crypto.randomBytes(32).toString('hex');
}

// ============================================================
// PII / SECRET SCRUBBER
// ============================================================

export function scrubSensitiveData(text: string): {
  cleanText: string;
  flagged: boolean;
  patterns: string[];
} {
  const patterns = [
    {
      regex:
        /(?:api[\_-]?key|apikey|secret[\_-]?key|password|pwd)[\s=:]+[^\s,;'"`]+/gi,
      name: 'API Key/Password',
    },
    {
      regex: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
      name: 'Bearer Token',
    },
    {
      regex: /sk-[a-zA-Z0-9]{32,}/g,
      name: 'OpenAI Key',
    },
    {
      regex: /ghp_[a-zA-Z0-9]{36}/g,
      name: 'GitHub Token',
    },
    {
      regex: /glpat-[a-zA-Z0-9_-]{20}/g,
      name: 'GitLab Token',
    },
    {
      regex:
        /[\w.-]+@[\w.-]+\.\w+\s+is\s+your\s+password/gi,
      name: 'Password Reference',
    },
    {
      regex:
        /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
      name: 'SSN',
    },
    {
      regex:
        /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
      name: 'Credit Card',
    },
  ];

  let cleanText = text;

  const flaggedPatterns: string[] = [];

  let flagged = false;

  for (const pattern of patterns) {
    const matches = text.match(pattern.regex);

    if (matches) {
      flagged = true;

      flaggedPatterns.push(pattern.name);

      cleanText = cleanText.replace(
        pattern.regex,
        `[REDACTED ${pattern.name}]`
      );
    }
  }

  return {
    cleanText,
    flagged,
    patterns: flaggedPatterns,
  };
}

// ============================================================
// CREATE WORKSPACE
// ============================================================

export async function createWorkspace(data: {
  name: string;
  slug?: string;
  description?: string;
  owner: string;
  organization?: string;
  allowedDomains?: string[];
  defaultRole?:
    | 'VIEWER'
    | 'COMMENTER'
    | 'EDITOR'
    | 'ADMIN';
  maxMembers?: number;
  tenantEncryptionKey?: string;
  compliancePolicies?: any;
  integrations?: any;
  settings?: any;
  parentWorkspace?: string;
  members?: string[];
}) {
  const session = await mongoose.startSession();

  try {
    logger.info({ values: [{
      name: data.name,
      owner: data.owner,
      organization: data.organization,
    }] }, 'Creating workspace:');

    session.startTransaction();

    // --------------------------------------------------------
    // Validate allowed email domains
    // --------------------------------------------------------

    if (
      data.allowedDomains &&
      data.allowedDomains.length > 0
    ) {
      for (const domain of data.allowedDomains) {
        if (
          !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(
            domain
          )
        ) {
          throw new Error(
            `Invalid domain format: ${domain}`
          );
        }
      }
    }

    // --------------------------------------------------------
    // Generate workspace slug
    // --------------------------------------------------------

    let slug =
      data.slug ||
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

    slug = await generateUniqueSlug(slug);

    // --------------------------------------------------------
    // Generate tenant encryption key
    // --------------------------------------------------------

    const tenantKey =
      data.tenantEncryptionKey ||
      generateTenantKey();

    // --------------------------------------------------------
    // Scrub workspace description
    // --------------------------------------------------------

    const scrubbedDescription = data.description
      ? scrubSensitiveData(data.description)
      : {
          cleanText: data.description || '',
          flagged: false,
          patterns: [],
        };

    if (scrubbedDescription.flagged) {
      logger.warn({ values: [scrubbedDescription.patterns] }, 'PII/Secrets detected in workspace description:');
    }

    // --------------------------------------------------------
    // Inherit policies from parent workspace
    // --------------------------------------------------------

    let inheritedPolicies = {
      rbac: false,
      compliance: false,
      security: false,
    };

    if (data.parentWorkspace) {
      const parent = await Workspace.findById(
        data.parentWorkspace
      ).session(session);

      if (parent) {
        inheritedPolicies =
          parent.inheritedPolicies ||
          inheritedPolicies;
      }
    }

    // --------------------------------------------------------
    // Inherit organization settings
    // --------------------------------------------------------

    const organizationSettings: {
      defaultRole?:
        | 'VIEWER'
        | 'COMMENTER'
        | 'EDITOR'
        | 'ADMIN';

      maxMembers?: number;

      allowedDomains?: string[];
    } = {};

    if (data.organization) {
      const org = await Organization.findById(
        data.organization
      ).session(session);

      if (org) {
        organizationSettings.defaultRole =
          data.defaultRole ||
          org.defaultWorkspaceSettings.defaultRole;

        organizationSettings.maxMembers =
          data.maxMembers ||
          org.defaultWorkspaceSettings.maxMembers;

        organizationSettings.allowedDomains =
          data.allowedDomains ||
          org.allowedDomains;
      }
    }

    // --------------------------------------------------------
    // Plan enforcement: cap owned workspaces per user.
    // --------------------------------------------------------

    const ownedCount = await Workspace.countDocuments({
      owner: data.owner,
    }).session(session);

    const planCheck = await assertPlanLimit({
      userId: data.owner,
      resource: 'workspaces',
      currentCount: ownedCount,
    });
    if (!planCheck.ok) {
      throw new PlanLimitError(
        planCheck.error,
        planCheck.status,
        planCheck.code ?? 'WORKSPACE_LIMIT_REACHED',
      );
    }

    // --------------------------------------------------------
    // Create workspace
    // --------------------------------------------------------

    const workspace = await Workspace.create(
      [
        {
          name: data.name,
          slug,
          description:
            scrubbedDescription.cleanText,

          owner: data.owner,

          organization: data.organization,

          allowedDomains:
            organizationSettings.allowedDomains ||
            data.allowedDomains ||
            [],

          defaultRole:
            organizationSettings.defaultRole ||
            data.defaultRole ||
            'EDITOR',

          maxMembers:
            organizationSettings.maxMembers ||
            data.maxMembers ||
            50,

          // Owner is counted immediately.
          currentMembers: 1,

          tenantEncryptionKey: tenantKey,

          compliancePolicies:
            data.compliancePolicies,

          integrations: data.integrations,

          settings: data.settings,

          parentWorkspace:
            data.parentWorkspace,

          inheritedPolicies,
        },
      ],
      { session }
    );

    const createdWorkspace = workspace[0];

    logger.info({ values: [createdWorkspace._id] }, 'Workspace created:');

    // --------------------------------------------------------
    // Add owner as workspace member
    // --------------------------------------------------------

    await WorkspaceMember.create(
      [
        {
          workspace: createdWorkspace._id,

          user: data.owner,

          role: 'OWNER',

          permissions: {
            canCreateProjects: true,
            canDeleteProjects: true,
            canInviteMembers: true,
            canManageSettings: true,
            canViewAnalytics: true,
          },
        },
      ],
      { session }
    );

    logger.info({ values: [data.owner] }, 'Workspace owner added:');

    // --------------------------------------------------------
    // Add additional workspace members
    // --------------------------------------------------------

    let addedMembersCount = 0;

    if (
      data.members &&
      data.members.length > 0
    ) {
      const User =
        (await import('@/models/User')).default;

      for (const memberEmail of data.members) {
        // ----------------------------------------------
        // Validate email domain
        // ----------------------------------------------

        if (
          createdWorkspace.allowedDomains &&
          createdWorkspace.allowedDomains.length > 0
        ) {
          if (
            !validateEmailDomain(
              memberEmail,
              createdWorkspace.allowedDomains
            )
          ) {
            throw new Error(
              `Email ${memberEmail} is not from an allowed domain`
            );
          }
        }

        // ----------------------------------------------
        // Find existing user
        // ----------------------------------------------

        const user = await User.findOne({
          email: memberEmail,
        }).session(session);

        if (!user) {
          logger.info({ values: [memberEmail] }, 'User not found, skipping member:');

          continue;
        }

        // ----------------------------------------------
        // Prevent duplicate membership
        // ----------------------------------------------

        const existingMember =
          await WorkspaceMember.findOne({
            workspace: createdWorkspace._id,
            user: user._id,
          }).session(session);

        if (existingMember) {
          logger.info({ values: [memberEmail] }, 'User already belongs to workspace, skipping:');

          continue;
        }

        // ----------------------------------------------
        // Create workspace membership
        // ----------------------------------------------

        await WorkspaceMember.create(
          [
            {
              workspace:
                createdWorkspace._id,

              user: user._id,

              role: createdWorkspace.defaultRole,

              invitedBy: data.owner,
            },
          ],
          { session }
        );

        addedMembersCount++;

        logger.info({ values: [{
            email: memberEmail,
            userId: user._id,
          }] }, 'Workspace member added:');
      }

      // ----------------------------------------------------
      // Update actual member count.
      //
      // Owner + successfully created members.
      // ----------------------------------------------------

      await Workspace.findByIdAndUpdate(
        createdWorkspace._id,
        {
          currentMembers:
            addedMembersCount + 1,
        },
        { session }
      );

      logger.info({ values: [addedMembersCount + 1] }, 'Workspace member count updated:');
    }

    await session.commitTransaction();

    logger.info({ values: [createdWorkspace._id] }, 'Workspace transaction committed:');

    return createdWorkspace;
  } catch (error) {
    await session.abortTransaction();

    logger.error({ err: error }, 'Failed to create workspace:');

    throw error;
  } finally {
    await session.endSession();
  }
}

// ============================================================
// GET USER WORKSPACES
// ============================================================

export async function getUserWorkspaces(
  userId: string
) {
  try {
    logger.info({ values: [userId] }, 'Fetching workspaces for user:');

    const memberships =
      await WorkspaceMember.find({
        user: userId,
      }).populate('workspace');

    logger.info({ values: [memberships.length] }, 'User workspaces found:');

    return memberships.map(
      (item) => item.workspace
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch user workspaces:');

    throw error;
  }
}

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/*
 * Paginated variant of getUserWorkspaces — same membership→workspace
 * resolution, deterministic ordering, bounded page size.
 */
export async function getUserWorkspacesPaginated(
  userId: string,
  pagination: PaginationInput,
): Promise<PaginatedResult<unknown>> {
  const { page, limit, skip } = pagination;

  const [memberships, total] = await Promise.all([
    WorkspaceMember.find({ user: userId })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('workspace')
      .lean(),
    WorkspaceMember.countDocuments({ user: userId }),
  ]);

  const items = memberships
    .map((item) => item.workspace)
    .filter(Boolean);

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

// ============================================================
// UPDATE WORKSPACE
// ============================================================

export async function updateWorkspace(
  id: string,
  data: any
) {
  try {
    logger.info({ values: [id] }, 'Updating workspace:');

    const existingWorkspace =
      await Workspace.findById(id);

    if (!existingWorkspace) {
      logger.error({ values: [id] }, 'Workspace not found:');

      return null;
    }

    const currentSettings =
      existingWorkspace.settings || {};

    const updateData = {
      ...data,
    };

    // Merge nested settings instead of replacing
    // the complete settings object.
    if (data.settings) {
      const currentSettingsObject =
        'toObject' in currentSettings &&
        typeof (currentSettings as any)
          .toObject === 'function'
          ? (currentSettings as any).toObject()
          : currentSettings;

      updateData.settings = {
        ...currentSettingsObject,
        ...data.settings,
      };
    }

    const updatedWorkspace =
      await Workspace.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    logger.info({ values: [id] }, 'Workspace updated:');

    return updatedWorkspace;
  } catch (error) {
    logger.error({ err: error }, 'Failed to update workspace:');

    throw error;
  }
}

// ============================================================
// DELETE WORKSPACE
// ============================================================

export async function deleteWorkspace(
  id: string
) {
  try {
    logger.info({ values: [id] }, 'Starting workspace deletion:');

    // --------------------------------------------------------
    // Load related models
    // --------------------------------------------------------

    const Project =
      (await import('@/models/Project')).default;

    const Task =
      (await import('@/models/Task')).default;

    const Comment =
      (await import('@/models/Comment')).default;

    const Notification =
      (await import('@/models/Notification')).default;

    // --------------------------------------------------------
    // Find all projects
    // --------------------------------------------------------

    const projects = await Project.find({
      workspace: id,
    }).select('_id');

    const projectIds = projects.map(
      (project) => project._id
    );

    logger.info({ values: [projectIds.length] }, 'Projects found for deletion:');

    // --------------------------------------------------------
    // Find tasks belonging to these projects.
    //
    // IMPORTANT:
    // Comments reference TASK IDs, not PROJECT IDs.
    // --------------------------------------------------------

    const tasks = await Task.find({
      project: {
        $in: projectIds,
      },
    }).select('_id');

    const taskIds = tasks.map(
      (task) => task._id
    );

    logger.info({ values: [taskIds.length] }, 'Tasks found for deletion:');

    // --------------------------------------------------------
    // Delete comments first
    // --------------------------------------------------------

    if (taskIds.length > 0) {
      await Comment.deleteMany({
        task: {
          $in: taskIds,
        },
      });

      logger.info({ values: [taskIds.length] }, 'Task comments deleted:');
    }

    // --------------------------------------------------------
    // Delete tasks
    // --------------------------------------------------------

    if (taskIds.length > 0) {
      await Task.deleteMany({
        _id: {
          $in: taskIds,
        },
      });

      logger.info({ values: [taskIds.length] }, 'Tasks deleted:');
    }

    // --------------------------------------------------------
    // Delete notifications related to workspace
    // --------------------------------------------------------

    await Notification.deleteMany({
      link: {
        $regex: id,
      },
    });

    logger.info('Workspace notifications deleted');

    // --------------------------------------------------------
    // Delete workspace members
    // --------------------------------------------------------

    await WorkspaceMember.deleteMany({
      workspace: id,
    });

    logger.info('Workspace members deleted');

    // --------------------------------------------------------
    // Delete projects
    // --------------------------------------------------------

    if (projectIds.length > 0) {
      await Project.deleteMany({
        _id: {
          $in: projectIds,
        },
      });

      logger.info({ values: [projectIds.length] }, 'Projects deleted:');
    }

    // --------------------------------------------------------
    // Delete workspace itself
    // --------------------------------------------------------

    const deletedWorkspace =
      await Workspace.findByIdAndDelete(id);

    if (!deletedWorkspace) {
      logger.error({ values: [id] }, 'Workspace not found:');

      return null;
    }

    logger.info({ values: [id] }, 'Workspace successfully deleted:');

    return deletedWorkspace;
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete workspace:');

    throw error;
  }
}

// ============================================================
// GET WORKSPACE
// ============================================================

export async function getWorkspaceById(
  id: string
) {
  try {
    logger.info({ values: [id] }, 'Fetching workspace:');

    const workspace =
      await Workspace.findById(id)
        .populate({ path: 'owner', select: '_id name email avatar' });

    if (!workspace) {
      logger.error({ values: [id] }, 'Workspace not found:');
    }

    return workspace;
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch workspace:');

    throw error;
  }
}

// ============================================================
// GET WORKSPACE MEMBERS
// ============================================================

export async function getWorkspaceMembers(
  workspaceId: string
) {
  try {
    logger.info({ values: [workspaceId] }, 'Fetching workspace members:');

    const members =
      await WorkspaceMember.find({
        workspace: workspaceId,
      })
        .populate({ path: 'user', select: '_id name email avatar' })
        .lean();

    logger.info({ values: [members.length] }, 'Workspace members found:');

    return members;
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch workspace members:');

    throw error;
  }
}

// ============================================================
// ADD WORKSPACE MEMBER
// ============================================================

export async function addWorkspaceMember(data: {
  workspace: string;
  user: string;
  role?: WorkspaceRole;
}) {
  try {
    logger.info({ values: [{
        workspace: data.workspace,
        user: data.user,
        role: data.role,
      }] }, 'Adding workspace member:');

    // --------------------------------------------------------
    // Check workspace exists
    // --------------------------------------------------------

    const workspace =
      await Workspace.findById(
        data.workspace
      );

    if (!workspace) {
      logger.error({ values: [data.workspace] }, 'Workspace not found:');

      throw new Error(
        'Workspace not found'
      );
    }

    // --------------------------------------------------------
    // Prevent duplicate membership
    // --------------------------------------------------------

    const existing =
      await WorkspaceMember.findOne({
        workspace: data.workspace,
        user: data.user,
      });

    if (existing) {
      logger.info({ values: [{
          workspace: data.workspace,
          user: data.user,
        }] }, 'User already belongs to workspace:');

      throw new Error(
        'User is already a member of this workspace'
      );
    }

    // --------------------------------------------------------
// Enforce workspace member limit
// --------------------------------------------------------

const currentMembers = workspace.currentMembers ?? 0;
// Effective cap = min(workspace setting, plan limit). Plan is
// resolved from the workspace owner's subscription scope.
const ownerPlan = await getEffectivePlan(String(workspace.owner), String(workspace._id));
const planMemberCap = limitsForPlan(ownerPlan).maxMembersPerWorkspace;
const maxMembers = Math.min(workspace.maxMembers ?? 50, planMemberCap);

logger.info({ values: [{
  workspaceId: data.workspace,
  currentMembers,
  maxMembers,
}] }, 'Workspace member limit check:');

if (currentMembers >= maxMembers) {
  logger.error({ values: [{
      workspace: data.workspace,
      currentMembers,
      maxMembers,
    }] }, 'Workspace member limit reached:');

  throw new PlanLimitError(
    'Workspace member limit reached',
    403,
    'MEMBER_LIMIT_REACHED',
  );
}

    // --------------------------------------------------------
    // Create membership
    // --------------------------------------------------------

    const member =
      await WorkspaceMember.create({
        workspace: data.workspace,

        user: data.user,

        // Default application role.
        // Mongoose schema also uses EDITOR as default.
        role:
          data.role ??
          workspace.defaultRole ??
          'EDITOR',
      });

    // --------------------------------------------------------
    // Keep workspace member counter synchronized
    // --------------------------------------------------------

    await Workspace.findByIdAndUpdate(
      data.workspace,
      {
        $inc: {
          currentMembers: 1,
        },
      }
    );

    logger.info({ values: [{
        id: member._id,
        workspace: member.workspace,
        user: member.user,
        role: member.role,
      }] }, 'Workspace member created:');

    return member;
  } catch (error) {
    logger.error({ err: error }, 'Failed to add workspace member:');

    throw error;
  }
}

// ============================================================
// UPDATE WORKSPACE MEMBER ROLE
// ============================================================

export async function updateWorkspaceMember(
  memberId: string,
  role: WorkspaceRole
) {
  try {
    logger.info({ values: [{
        memberId,
        role,
      }] }, 'Updating workspace member:');

    const member =
      await WorkspaceMember.findByIdAndUpdate(
        memberId,
        {
          role,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!member) {
      logger.error({ values: [memberId] }, 'Workspace member not found:');

      throw new Error(
        'Workspace member not found'
      );
    }

    logger.info({ values: [{
        memberId,
        role: member.role,
      }] }, 'Workspace member role updated:');

    return member;
  } catch (error) {
    logger.error({ err: error }, 'Failed to update workspace member:');

    throw error;
  }
}

// ============================================================
// REMOVE WORKSPACE MEMBER
// ============================================================

export async function removeWorkspaceMember(
  memberId: string
) {
  try {
    logger.info({ values: [memberId] }, 'Removing workspace member:');

    const member =
      await WorkspaceMember.findByIdAndDelete(
        memberId
      );

    if (!member) {
      logger.error({ values: [memberId] }, 'Workspace member not found:');

      throw new Error(
        'Workspace member not found'
      );
    }

    // --------------------------------------------------------
    // Keep workspace member counter synchronized
    // --------------------------------------------------------

    await Workspace.findByIdAndUpdate(
      member.workspace,
      {
        $inc: {
          currentMembers: -1,
        },
      }
    );

    logger.info({ values: [{
        memberId,
        workspace: member.workspace,
        user: member.user,
      }] }, 'Workspace member removed:');

    return member;
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove workspace member:');

    throw error;
  }
}