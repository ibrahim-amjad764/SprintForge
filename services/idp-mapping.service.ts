// services/idp-mapping.service.ts
import Organization from '@/models/Organization';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import User from '@/models/User';

export interface IdPGroupMapping {
  idpGroup: string;
  workspaceRole: "OWNER" | "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";
  permissions?: string[];
}

export interface IdPUser {
  email: string;
  groups: string[];
  name?: string;
}

// Sync IdP groups to workspace roles
export async function syncIdpGroupsToWorkspace(params: {
  workspaceId: string;
  users: IdPUser[];
  groupMappings: IdPGroupMapping[];
}): Promise<{ synced: number; errors: string[] }> {
  const { workspaceId, users, groupMappings } = params;
  const errors: string[] = [];
  let synced = 0;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  for (const idpUser of users) {
    try {
      // Find or create user
      let user = await User.findOne({ email: idpUser.email });
      
      if (!user) {
        // In a real implementation, you might send an invitation email
        // For now, we'll skip users that don't exist
        errors.push(`User ${idpUser.email} not found in system`);
        continue;
      }

      // Determine role based on group mappings
      let assignedRole: "OWNER" | "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER" = "VIEWER";
      
      for (const mapping of groupMappings) {
        if (idpUser.groups.includes(mapping.idpGroup)) {
          assignedRole = mapping.workspaceRole;
          break;
        }
      }

      // Check if user is already a member
      const existingMember = await WorkspaceMember.findOne({
        workspace: workspaceId,
        user: user._id,
      });

      if (existingMember) {
        // Update role if different
        if (existingMember.role !== assignedRole) {
          await WorkspaceMember.findByIdAndUpdate(existingMember._id, {
            role: assignedRole,
          });
          synced++;
        }
      } else {
        // Add as new member
        await WorkspaceMember.create({
          workspace: workspaceId,
          user: user._id,
          role: assignedRole,
          invitedBy: workspace.owner,
        });
        synced++;
      }
    } catch (error) {
      errors.push(`Failed to sync user ${idpUser.email}: ${error}`);
    }
  }

  // Update workspace member count
  const memberCount = await WorkspaceMember.countDocuments({ workspace: workspaceId });
  await Workspace.findByIdAndUpdate(workspaceId, { currentMembers: memberCount });

  return { synced, errors };
}

// Get group mappings for an organization
export async function getOrganizationGroupMappings(organizationId: string): Promise<IdPGroupMapping[]> {
  const org = await Organization.findById(organizationId);
  
  if (!org?.rbacPolicies?.roles) {
    return [];
  }

  return org.rbacPolicies.roles.map((role: any) => ({
    idpGroup: role.name,
    workspaceRole: role.workspaceRole || "VIEWER",
    permissions: role.permissions || [],
  }));
}

// Set group mappings for an organization
export async function setOrganizationGroupMappings(
  organizationId: string,
  mappings: IdPGroupMapping[]
): Promise<void> {
  await Organization.findByIdAndUpdate(organizationId, {
    'rbacPolicies.roles': mappings.map(m => ({
      name: m.idpGroup,
      workspaceRole: m.workspaceRole,
      permissions: m.permissions || [],
    })),
  });
}

// Sync users from Okta
export async function syncOktaUsers(params: {
  workspaceId: string;
  oktaDomain: string;
  oktaToken: string;
}): Promise<{ synced: number; errors: string[] }> {
  const { workspaceId, oktaDomain, oktaToken } = params;

  try {
    // Fetch users from Okta API
    const response = await fetch(`https://${oktaDomain}/api/v1/users`, {
      headers: {
        'Authorization': `SSWS ${oktaToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Okta API error: ${response.status}`);
    }

    const oktaUsers = await response.json();
    
    // Transform to IdPUser format
    const idpUsers: IdPUser[] = oktaUsers.map((user: any) => ({
      email: user.profile.email,
      groups: user.profile.groups || [],
      name: user.profile.displayName,
    }));

    // Get organization group mappings
    const workspace = await Workspace.findById(workspaceId);
    const mappings = workspace?.organization 
      ? await getOrganizationGroupMappings(workspace.organization.toString())
      : [];

    // Sync users
    return await syncIdpGroupsToWorkspace({
      workspaceId,
      users: idpUsers,
      groupMappings: mappings,
    });
  } catch (error) {
    console.error('Okta sync error:', error);
    return { synced: 0, errors: [error.message] };
  }
}

// Sync users from Azure AD
export async function syncAzureAdUsers(params: {
  workspaceId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ synced: number; errors: string[] }> {
  const { workspaceId, tenantId, clientId, clientSecret } = params;

  try {
    // Get access token
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Azure AD access token');
    }

    const { access_token } = await tokenResponse.json();

    // Fetch users from Microsoft Graph API
    const usersResponse = await fetch('https://graph.microsoft.com/v1.0/users?$select=displayName,mail,memberOf', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      throw new Error(`Microsoft Graph API error: ${usersResponse.status}`);
    }

    const { value: azureUsers } = await usersResponse.json();
    
    // Transform to IdPUser format
    const idpUsers: IdPUser[] = azureUsers.map((user: any) => ({
      email: user.mail,
      groups: user.memberOf?.map((group: any) => group.id) || [],
      name: user.displayName,
    }));

    // Get organization group mappings
    const workspace = await Workspace.findById(workspaceId);
    const mappings = workspace?.organization 
      ? await getOrganizationGroupMappings(workspace.organization.toString())
      : [];

    // Sync users
    return await syncIdpGroupsToWorkspace({
      workspaceId,
      users: idpUsers,
      groupMappings: mappings,
    });
  } catch (error) {
    console.error('Azure AD sync error:', error);
    return { synced: 0, errors: [error.message] };
  }
}

// Auto-sync on workspace creation if enabled
export async function autoSyncIdpGroups(workspaceId: string): Promise<void> {
  const workspace = await Workspace.findById(workspaceId).populate('organization');
  
  if (!workspace?.settings?.idpGroupMapping || !workspace.organization) {
    return;
  }

  const org = workspace.organization as any;
  
  if (org.idpSettings?.provider === 'OKTA' && org.idpSettings?.clientId) {
    // In a real implementation, you'd store the Okta token securely
    // await syncOktaUsers({ workspaceId, oktaDomain: org.idpSettings.domain, oktaToken: '...' });
  } else if (org.idpSettings?.provider === 'AZURE_AD') {
    // In a real implementation, you'd store the Azure AD credentials securely
    // await syncAzureAdUsers({ workspaceId, tenantId: org.idpSettings.domain, clientId: org.idpSettings.clientId, clientSecret: '...' });
  }
}
