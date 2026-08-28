// app/api/workspaces/[id]/members/[memberId]/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { updateWorkspaceMember, removeWorkspaceMember } from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    await connectDB();
    const { memberId } = await context.params;
    const body = await request.json();
    
    const member = await updateWorkspaceMember(memberId, body.role);
    return successResponse(member, 'Member role updated');
  } catch (error) {
    console.error('Update member error:', error);
    return errorResponse('Server error', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    await connectDB();
    const { memberId } = await context.params;
    
    await removeWorkspaceMember(memberId);
    return successResponse(null, 'Member removed');
  } catch (error) {
    console.error('Remove member error:', error);
    return errorResponse('Server error', 500);
  }
}
