// app/api/ai/task-breakdown/route.ts
import { NextRequest } from 'next/server';
import { generateTaskBreakdown } from '@/services/ai.service';
import { successResponse, errorResponse } from '@/utils/response';
import { createTask } from '@/services/task.service';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  getMembershipForProject,
  getMembershipForTask,
  canWriteWorkspace,
} from '@/lib/authorization';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();
    const body = await request.json();

    // IDOR+RBAC: write-capable member of the workspace owning the task
    const taskMembership = await getMembershipForTask(String(body.task), userId);
    if (!body.task || !taskMembership || !canWriteWorkspace(taskMembership.role)) {
      return errorResponse('Forbidden', 403);
    }

    // If subtasks will be persisted, the target project must also be
    // writable by this user
    if (body.projectId) {
      const projectMembership = await getMembershipForProject(
        String(body.projectId),
        userId,
      );
      if (!projectMembership || !canWriteWorkspace(projectMembership.role)) {
        return errorResponse('Forbidden', 403);
      }
    }

    const result = await generateTaskBreakdown(body.task);

    // If project is provided, save subtasks to database
    if (body.projectId && result.subtasks && Array.isArray(result.subtasks)) {
      const createdTasks = [];
      for (const subtask of result.subtasks) {
        const dueDate = subtask.estimatedDays 
          ? new Date(Date.now() + subtask.estimatedDays * 24 * 60 * 60 * 1000)
          : undefined;

        const task = await createTask({
          title: subtask.title,
          description: subtask.description,
          project: body.projectId,
          priority: subtask.priority || 'MEDIUM',
        });

        if (dueDate) {
          await (await import('@/models/Task')).default.findByIdAndUpdate(
            task._id,
            { dueDate }
          );
        }

        createdTasks.push(task);
      }

      return successResponse({
        subtasks: result.subtasks,
        createdTasks,
      });
    }

    return successResponse(result);
  } catch (error) {
    return errorResponse('AI failed', 500);
  }
}
