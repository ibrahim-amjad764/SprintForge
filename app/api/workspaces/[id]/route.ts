import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
} from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getWorkspaceMembership } from '@/lib/authorization';
import type { WorkspaceRole } from '@/models/WorkspaceMember';
import logger from '@/lib/logger';

const ADMIN_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN'];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;

    // IDOR: user must be a member of this workspace
    const membership = await getWorkspaceMembership(id, userId);
    if (!membership) {
      return errorResponse('Forbidden', 403);
    }

    const workspace = await getWorkspaceById(id);

    if (!workspace) {
      return errorResponse('Workspace not found', 404);
    }

    return successResponse(workspace);
  } catch (error) {
    logger.error({ err: error }, 'Get workspace error:');
    return errorResponse('Error fetching workspace', 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    // Only workspace owners/admins may modify settings
    const membership = await getWorkspaceMembership(id, userId);
    if (!membership || !ADMIN_ROLES.includes(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    const workspace = await updateWorkspace(id, body);

    if (!workspace) {
      return errorResponse('Workspace not found', 404);
    }

    return successResponse(workspace, 'Workspace updated');
  } catch (error) {
    logger.error({ err: error }, 'Update workspace error:');
    return errorResponse('Error updating workspace', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;

    // Only workspace owners/admins may delete the workspace
    const membership = await getWorkspaceMembership(id, userId);
    if (!membership || !ADMIN_ROLES.includes(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    await deleteWorkspace(id);
    return successResponse(null, 'Workspace deleted');
  } catch (error) {
    logger.error({ err: error }, 'Delete workspace error:');
    return errorResponse('Error deleting workspace', 500);
  }
}
