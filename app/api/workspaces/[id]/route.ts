import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
} from '@/services/workspace.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const workspace = await getWorkspaceById(id);

    if (!workspace) {
      return errorResponse('Workspace not found', 404);
    }

    return successResponse(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    return errorResponse('Error fetching workspace', 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    const workspace = await updateWorkspace(id, body);

    if (!workspace) {
      return errorResponse('Workspace not found', 404);
    }

    return successResponse(workspace, 'Workspace updated');
  } catch (error) {
    console.error('Update workspace error:', error);
    return errorResponse('Error updating workspace', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await context.params;

    await deleteWorkspace(id);
    return successResponse(null, 'Workspace deleted');
  } catch (error) {
    console.error('Delete workspace error:', error);
    return errorResponse('Error deleting workspace', 500);
  }
}
