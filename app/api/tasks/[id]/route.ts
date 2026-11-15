// app/api/tasks/[id]/route.ts

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { updateTask, deleteTask } from "@/services/task.service";
import { successResponse, errorResponse } from "@/utils/response";
import { requireAuth } from "@/lib/auth";
import { getMembershipForTask, canWriteWorkspace } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const body = await request.json();
    const { id } = await context.params;

    // IDOR+RBAC: write-capable member of the task's workspace required
    const membership = await getMembershipForTask(id, userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse("Forbidden", 403);
    }

    const task = await updateTask(id, body);

    // Revalidate project pages when task status changes
    if (body.status || body.project) {
      const projectId = body.project || task.project;
      if (projectId) {
        revalidatePath(`/workspace/*/projects/${projectId}`);
        revalidatePath(`/workspace/*/projects/${projectId}/board`);
        revalidatePath(`/workspace/*/projects/${projectId}/tasks`);
        revalidatePath(`/workspace/*/projects`); // Revalidate projects list
      }
    }

    return successResponse(task, "Task updated");
  } catch (error) {
    return errorResponse("Update failed", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const { id } = await context.params;

    // IDOR+RBAC: write-capable member of the task's workspace required
    const membership = await getMembershipForTask(id, userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse("Forbidden", 403);
    }

    const task = await deleteTask(id);

    // Revalidate project pages when task is deleted
    if (task && task.project) {
      revalidatePath(`/workspace/*/projects/${task.project}`);
      revalidatePath(`/workspace/*/projects/${task.project}/board`);
      revalidatePath(`/workspace/*/projects/${task.project}/tasks`);
      revalidatePath(`/workspace/*/projects`); // Revalidate projects list
    }

    return successResponse(null, "Task deleted");
  } catch (error) {
    return errorResponse("Delete failed", 500);
  }
}
