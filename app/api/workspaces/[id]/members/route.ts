// app/api/workspaces/[id]/members/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getWorkspaceMembers, addWorkspaceMember } from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';
import { getWorkspaceMembership } from '@/lib/authorization';
import type { WorkspaceRole } from '@/models/WorkspaceMember';

const VALID_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER'];
const ADMIN_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN'];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;

    // IDOR: user must be a member of this workspace
    const membership = await getWorkspaceMembership(id, userId);
    if (!membership) {
      return errorResponse('Forbidden', 403);
    }

    const members = await getWorkspaceMembers(id);
    return successResponse(members);
  } catch (error) {
    console.error('Get members error:', error);
    return errorResponse('Server error', 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    // Only owners/admins may add members
    const membership = await getWorkspaceMembership(id, userId);
    if (!membership || !ADMIN_ROLES.includes(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    // Never trust client-supplied role — validate against the enum
    const role = VALID_ROLES.includes(body.role) ? body.role : 'VIEWER';
    if (role === 'OWNER' && membership.role !== 'OWNER') {
      return errorResponse('Forbidden', 403);
    }

    if (!body.user) {
      return errorResponse('User is required', 400);
    }

    const member = await addWorkspaceMember({
      workspace: id,
      user: body.user,
      role,
    });

    return successResponse(member, 'Member added');
  } catch (error) {
    console.error('Add member error:', error);
    return errorResponse('Server error', 500);
  }
}
