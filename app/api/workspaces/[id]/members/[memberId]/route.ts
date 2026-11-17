// app/api/workspaces/[id]/members/[memberId]/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import WorkspaceMember from '@/models/WorkspaceMember';
import { updateWorkspaceMember, removeWorkspaceMember } from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getWorkspaceMembership } from '@/lib/authorization';
import type { WorkspaceRole } from '@/models/WorkspaceMember';
import logger from '@/lib/logger';

const VALID_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER'];
const ADMIN_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN'];

/*
    Resolve the member document and verify it belongs to the
    workspace in the URL — prevents cross-workspace memberId IDOR.
*/
async function getAuthorizedMember(
  workspaceId: string,
  memberId: string,
  userId: string,
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return null;
  }

  const member = await WorkspaceMember.findById(memberId)
    .select('workspace role')
    .lean();

  if (!member || String(member.workspace) !== workspaceId) {
    return null;
  }

  return member;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id, memberId } = await context.params;
    const body = await request.json();

    const member = await getAuthorizedMember(id, memberId, userId);
    if (!member) {
      return errorResponse('Forbidden', 403);
    }

    // Never trust client-supplied role — validate against the enum
    const role = VALID_ROLES.includes(body.role) ? body.role : member.role;
    if (role === 'OWNER') {
      const caller = await getWorkspaceMembership(id, userId);
      if (caller?.role !== 'OWNER') {
        return errorResponse('Forbidden', 403);
      }
    }

    const updated = await updateWorkspaceMember(memberId, role);
    return successResponse(updated, 'Member role updated');
  } catch (error) {
    logger.error({ err: error }, 'Update member error:');
    return errorResponse('Server error', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id, memberId } = await context.params;

    const member = await getAuthorizedMember(id, memberId, userId);
    if (!member) {
      return errorResponse('Forbidden', 403);
    }

    // An admin cannot remove the workspace owner
    if (member.role === 'OWNER') {
      const caller = await getWorkspaceMembership(id, userId);
      if (caller?.role !== 'OWNER') {
        return errorResponse('Forbidden', 403);
      }
    }

    await removeWorkspaceMember(memberId);
    return successResponse(null, 'Member removed');
  } catch (error) {
    logger.error({ err: error }, 'Remove member error:');
    return errorResponse('Server error', 500);
  }
}
