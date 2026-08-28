// app/api/workspaces/[id]/members/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getWorkspaceMembers, addWorkspaceMember } from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await context.params;
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
    await connectDB();
    const { id } = await context.params;
    const body = await request.json();
    
    const member = await addWorkspaceMember({
      workspace: id,
      user: body.user,
      role: body.role || 'MEMBER',
    });
    
    return successResponse(member, 'Member added');
  } catch (error: any) {
    console.error('Add member error:', error);
    return errorResponse(error.message || 'Server error', 500);
  }
}
