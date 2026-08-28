// services/workspace.service.ts

import Workspace from '@/models/Workspace';
import WorkspaceMember, {
  WorkspaceRole,
} from '@/models/WorkspaceMember';
import Organization from '@/models/Organization';
import mongoose from 'mongoose';
import crypto from 'crypto';

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
    console.log('Workspace slug available:', baseSlug);

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
      console.log('Generated unique workspace slug:', alt);

      return alt;
    }
  }

  const fallbackSlug = `${baseSlug}-${Date.now()}`;

  console.log(
    'Using fallback workspace slug:',
    fallbackSlug
  );

  return fallbackSlug;
}

// ============================================================
// TENANT ENCRYPTION KEY
// ============================================================

export function generateTenantKey(): string {
  console.log('Generating tenant encryption key');

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
    console.log('Creating workspace:', {
      name: data.name,
      owner: data.owner,
      organization: data.organization,
    });

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
      console.warn(
        'PII/Secrets detected in workspace description:',
        scrubbedDescription.patterns
      );
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

    console.log(
      'Workspace created:',
      createdWorkspace._id
    );

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

    console.log(
      'Workspace owner added:',
      data.owner
    );

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
          console.log(
            'User not found, skipping member:',
            memberEmail
          );

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
          console.log(
            'User already belongs to workspace, skipping:',
            memberEmail
          );

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

        console.log(
          'Workspace member added:',
          {
            email: memberEmail,
            userId: user._id,
          }
        );
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

      console.log(
        'Workspace member count updated:',
        addedMembersCount + 1
      );
    }

    await session.commitTransaction();

    console.log(
      'Workspace transaction committed:',
      createdWorkspace._id
    );

    return createdWorkspace;
  } catch (error) {
    await session.abortTransaction();

    console.error(
      'Failed to create workspace:',
      error
    );

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
    console.log(
      'Fetching workspaces for user:',
      userId
    );

    const memberships =
      await WorkspaceMember.find({
        user: userId,
      }).populate('workspace');

    console.log(
      'User workspaces found:',
      memberships.length
    );

    return memberships.map(
      (item) => item.workspace
    );
  } catch (error) {
    console.error(
      'Failed to fetch user workspaces:',
      error
    );

    throw error;
  }
}

// ============================================================
// UPDATE WORKSPACE
// ============================================================

export async function updateWorkspace(
  id: string,
  data: any
) {
  try {
    console.log(
      'Updating workspace:',
      id
    );

    const existingWorkspace =
      await Workspace.findById(id);

    if (!existingWorkspace) {
      console.error(
        'Workspace not found:',
        id
      );

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

    console.log(
      'Workspace updated:',
      id
    );

    return updatedWorkspace;
  } catch (error) {
    console.error(
      'Failed to update workspace:',
      error
    );

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
    console.log(
      'Starting workspace deletion:',
      id
    );

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

    console.log(
      'Projects found for deletion:',
      projectIds.length
    );

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

    console.log(
      'Tasks found for deletion:',
      taskIds.length
    );

    // --------------------------------------------------------
    // Delete comments first
    // --------------------------------------------------------

    if (taskIds.length > 0) {
      await Comment.deleteMany({
        task: {
          $in: taskIds,
        },
      });

      console.log(
        'Task comments deleted:',
        taskIds.length
      );
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

      console.log(
        'Tasks deleted:',
        taskIds.length
      );
    }

    // --------------------------------------------------------
    // Delete notifications related to workspace
    // --------------------------------------------------------

    await Notification.deleteMany({
      link: {
        $regex: id,
      },
    });

    console.log(
      'Workspace notifications deleted'
    );

    // --------------------------------------------------------
    // Delete workspace members
    // --------------------------------------------------------

    await WorkspaceMember.deleteMany({
      workspace: id,
    });

    console.log(
      'Workspace members deleted'
    );

    // --------------------------------------------------------
    // Delete projects
    // --------------------------------------------------------

    if (projectIds.length > 0) {
      await Project.deleteMany({
        _id: {
          $in: projectIds,
        },
      });

      console.log(
        'Projects deleted:',
        projectIds.length
      );
    }

    // --------------------------------------------------------
    // Delete workspace itself
    // --------------------------------------------------------

    const deletedWorkspace =
      await Workspace.findByIdAndDelete(id);

    if (!deletedWorkspace) {
      console.error(
        'Workspace not found:',
        id
      );

      return null;
    }

    console.log(
      'Workspace successfully deleted:',
      id
    );

    return deletedWorkspace;
  } catch (error) {
    console.error(
      'Failed to delete workspace:',
      error
    );

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
    console.log(
      'Fetching workspace:',
      id
    );

    const workspace =
      await Workspace.findById(id)
        .populate('owner');

    if (!workspace) {
      console.error(
        'Workspace not found:',
        id
      );
    }

    return workspace;
  } catch (error) {
    console.error(
      'Failed to fetch workspace:',
      error
    );

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
    console.log(
      'Fetching workspace members:',
      workspaceId
    );

    const members =
      await WorkspaceMember.find({
        workspace: workspaceId,
      })
        .populate('user')
        .lean();

    console.log(
      'Workspace members found:',
      members.length
    );

    return members;
  } catch (error) {
    console.error(
      'Failed to fetch workspace members:',
      error
    );

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
    console.log(
      'Adding workspace member:',
      {
        workspace: data.workspace,
        user: data.user,
        role: data.role,
      }
    );

    // --------------------------------------------------------
    // Check workspace exists
    // --------------------------------------------------------

    const workspace =
      await Workspace.findById(
        data.workspace
      );

    if (!workspace) {
      console.error(
        'Workspace not found:',
        data.workspace
      );

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
      console.log(
        'User already belongs to workspace:',
        {
          workspace: data.workspace,
          user: data.user,
        }
      );

      throw new Error(
        'User is already a member of this workspace'
      );
    }

    // --------------------------------------------------------
// Enforce workspace member limit
// --------------------------------------------------------

const currentMembers = workspace.currentMembers ?? 0;
const maxMembers = workspace.maxMembers ?? 50;

console.log('Workspace member limit check:', {
  workspaceId: data.workspace,
  currentMembers,
  maxMembers,
});

if (currentMembers >= maxMembers) {
  console.error(
    'Workspace member limit reached:',
    {
      workspace: data.workspace,
      currentMembers,
      maxMembers,
    }
  );

  throw new Error(
    'Workspace member limit reached'
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

    console.log(
      'Workspace member created:',
      {
        id: member._id,
        workspace: member.workspace,
        user: member.user,
        role: member.role,
      }
    );

    return member;
  } catch (error) {
    console.error(
      'Failed to add workspace member:',
      error
    );

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
    console.log(
      'Updating workspace member:',
      {
        memberId,
        role,
      }
    );

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
      console.error(
        'Workspace member not found:',
        memberId
      );

      throw new Error(
        'Workspace member not found'
      );
    }

    console.log(
      'Workspace member role updated:',
      {
        memberId,
        role: member.role,
      }
    );

    return member;
  } catch (error) {
    console.error(
      'Failed to update workspace member:',
      error
    );

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
    console.log(
      'Removing workspace member:',
      memberId
    );

    const member =
      await WorkspaceMember.findByIdAndDelete(
        memberId
      );

    if (!member) {
      console.error(
        'Workspace member not found:',
        memberId
      );

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

    console.log(
      'Workspace member removed:',
      {
        memberId,
        workspace: member.workspace,
        user: member.user,
      }
    );

    return member;
  } catch (error) {
    console.error(
      'Failed to remove workspace member:',
      error
    );

    throw error;
  }
}