// app/api/workspace/[id]/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Workspace from "@/models/Workspace";
import { updateWorkspace, deleteWorkspace } from "@/services/workspace.service";
import { successResponse, errorResponse } from "@/utils/response";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await connectDB();
    const { id } = await context.params;  // ← AWAIT params
    const workspace = await Workspace.findById(id).populate("owner");
    
    if (!workspace) {
      return errorResponse("Workspace not found", 404);
    }

    return successResponse(workspace);
  } catch (error) {
    return errorResponse("Error fetching workspace", 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await connectDB();
    const { id } = await context.params;  // ← AWAIT params
    const body = await request.json();
    const workspace = await updateWorkspace(id, body);

    return successResponse(workspace, "Workspace updated");
  } catch (error) {
    return errorResponse("Error updating workspace", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await connectDB();
    const { id } = await context.params;  // ← AWAIT params

    await deleteWorkspace(id);
    return successResponse(null, "Workspace deleted");
  } catch (error) {
    return errorResponse("Error deleting workspace", 500);
  }
}