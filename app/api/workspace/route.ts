// app/api/workspace/route.ts

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { validateSessionToken } from "@/lib/session";
import { createWorkspace, getUserWorkspaces } from "@/services/workspace.service";
import { dispatchWorkspaceCreatedEvent } from "@/services/webhook.service";
import { autoProvisionRepository } from "@/services/vcs-provisioning.service";
import { autoSyncIdpGroups } from "@/services/idp-mapping.service";
import { scheduleDataRetention } from "@/services/data-retention.service";
import { successResponse, errorResponse } from "@/utils/response";
import { getWorkspaceMembership } from "@/lib/authorization";
import logger from '@/lib/logger';

/*
    Workspace API
    GET
    -> Get user workspaces
    POST
    -> Create workspace with enterprise features
*/

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) return null;

  const session = await validateSessionToken(token);
  return session?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = await getUserId(request);

    if (!userId) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();

    // IDOR: a child workspace may only be created under a parent
    // workspace the user belongs to
    if (body.parentWorkspace) {
      const parentMembership = await getWorkspaceMembership(
        String(body.parentWorkspace),
        userId,
      );
      if (!parentMembership) {
        return errorResponse("Forbidden", 403);
      }
    }

    // Transform integrations from simple booleans to schema-expected structure
    const transformedIntegrations: any = {};
    if (body.integrations) {
      if (body.integrations.slack !== undefined) transformedIntegrations.slack = { enabled: body.integrations.slack };
      if (body.integrations.teams !== undefined) transformedIntegrations.teams = { enabled: body.integrations.teams };
      if (body.integrations.googleCalendar !== undefined) transformedIntegrations.googleCalendar = { enabled: body.integrations.googleCalendar };
      if (body.integrations.outlookCalendar !== undefined) transformedIntegrations.outlookCalendar = { enabled: body.integrations.outlookCalendar };
      if (body.integrations.github !== undefined) transformedIntegrations.github = { enabled: body.integrations.github };
      if (body.integrations.gitlab !== undefined) transformedIntegrations.gitlab = { enabled: body.integrations.gitlab };
    }

    // Merge integrationConfig into settings for storage
    const settingsWithConfig = {
      ...body.settings,
      integrationConfig: body.integrationConfig,
    };

    const workspace = await createWorkspace({
      name: body.name,
      slug: body.slug,
      description: body.description,
      owner: userId,
      organization: body.organization,
      allowedDomains: body.allowedDomains,
      defaultRole: body.defaultRole,
      maxMembers: body.maxMembers,
      tenantEncryptionKey: body.tenantEncryptionKey,
      compliancePolicies: body.compliancePolicies,
      integrations: transformedIntegrations,
      settings: settingsWithConfig,
      parentWorkspace: body.parentWorkspace,
      members: body.members,
    });

    // Schedule data retention if compliance policies are set
    if (body.compliancePolicies?.dataRetentionDays) {
      await scheduleDataRetention(workspace._id.toString(), body.compliancePolicies.dataRetentionDays);
    }

    // Auto-provision repository if enabled
    if (body.settings?.autoCreateRepository) {
      await autoProvisionRepository(workspace._id.toString());
    }

    // Auto-sync IdP groups if enabled
    if (body.settings?.idpGroupMapping) {
      await autoSyncIdpGroups(workspace._id.toString());
    }

    // Dispatch webhook event
    await dispatchWorkspaceCreatedEvent(workspace);

    return successResponse(workspace, "Workspace created");
  } catch (error: any) {
    logger.error({ err: error }, "Workspace creation error:");
    return errorResponse(error.message || "Server error", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = await getUserId(request);

    if (!userId) {
      return errorResponse("Unauthorized", 401);
    }

    const workspaces = await getUserWorkspaces(userId);

    return successResponse(workspaces);
  } catch (error) {
    return errorResponse("Server error", 500);
  }
}
