// app/api/ai/task-breakdown/route.ts
import { NextRequest } from 'next/server';
import { generateTaskBreakdown } from '@/services/ai.service';
import { successResponse, errorResponse } from '@/utils/response';
import { createTask } from '@/services/task.service';
import { connectDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

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
