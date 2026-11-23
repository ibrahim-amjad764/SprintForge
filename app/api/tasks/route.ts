// app/api/tasks/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { createTask, getTasks, getTasksByWorkspace, getTasksPaginated, getTasksByWorkspacePaginated } from '@/services/task.service';
import { parsePaginationParams } from '@/lib/pagination';
import { successResponse, errorResponse } from '@/utils/response';
import { rateLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/session';
import {
  getMembershipForProject,
  getMembershipForTeam,
  getWorkspaceMembership,
  canWriteWorkspace,
  isWorkspaceMember,
} from '@/lib/authorization';
import { revalidatePath } from 'next/cache';
import Team from '@/models/Team';
import logger from '@/lib/logger';
import { apiError } from '@/utils/error-handler';

/*
 Task API

 .POST
   Create Task

 .GET
   Get Project Tasks
*/

function getClientIP(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    if (!rateLimit(ip)) {
      return Response.json(
        {
          message: 'Too many requests',
        },
        {
          status: 429,
        }
      );
    }

    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const body = await request.json();

    const projectField = body.project || body.projectId;

    if (!projectField) {
      return errorResponse('Project ID is required', 400);
    }

    // IDOR: user must be a member of the project's workspace.
    // RBAC: creating tasks requires a write-capable role
    // (VIEWER and COMMENTER are read/comment-only).
    const membership = await getMembershipForProject(String(projectField), userId);
    if (!membership || !canWriteWorkspace(membership.role)) {
      return errorResponse('Forbidden', 403);
    }

    // The team must belong to the SAME workspace as the project —
    // membership in some other workspace is not sufficient.
    if (body.teamId && typeof body.teamId === 'string') {
      const teamMembership = await getMembershipForTeam(body.teamId, userId);
      if (!teamMembership || teamMembership.workspaceId !== membership.workspaceId) {
        return errorResponse('Forbidden', 403);
      }
    }

    // The assignee must be a member (or owner) of the same workspace
    if (body.assignee && typeof body.assignee === 'string') {
      const assigneeIsMember = await isWorkspaceMember(
        membership.workspaceId,
        body.assignee,
      );
      if (!assigneeIsMember) {
        return errorResponse('Assignee is not a member of this workspace', 400);
      }
    }

    if (!body.title || !body.title.trim()) {
      return errorResponse('Task title is required', 400);
    }

    // Handle date conversion to prevent timezone bugs
    let processedDueDate: Date | undefined;
    if (body.dueDate) {
      try {
        // If it's already a Date object, use it directly
        if (body.dueDate instanceof Date) {
          processedDueDate = body.dueDate;
        } 
        // If it's an ISO string, parse it properly
        else if (typeof body.dueDate === 'string') {
          // Handle YYYY-MM-DD format from date input to prevent timezone shifting
          if (body.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Parse as local date by appending T00:00:00 to prevent UTC conversion
            const localDate = new Date(body.dueDate + 'T00:00:00');
            if (!isNaN(localDate.getTime())) {
              processedDueDate = localDate;
            }
          } else {
            // Handle ISO strings
            const date = new Date(body.dueDate);
            if (!isNaN(date.getTime())) {
              processedDueDate = date;
            }
          }
        }
        
        logger.info({ values: [processedDueDate] }, '📅 Processed Due Date:');
      } catch (error) {
        logger.error({ err: error, context: [body.dueDate] }, '❌ Invalid due date format:');
        return errorResponse('Invalid due date format', 400);
      }
    }

    // Validate assignee if provided
    if (body.assignee && typeof body.assignee !== 'string') {
      return errorResponse('Invalid assignee format', 400);
    }

    // Validate teamId if provided
    if (body.teamId && typeof body.teamId !== 'string') {
      return errorResponse('Invalid teamId format', 400);
    }

    const taskData: any = {
      title: body.title.trim(),
      description: body.description?.trim() || '',
      project: projectField,
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
    };

    // Only add optional fields if they exist
    if (body.assignee) taskData.assignee = body.assignee;
    if (body.teamId) taskData.teamId = body.teamId;
    if (processedDueDate) taskData.dueDate = processedDueDate;

    const task = await createTask(taskData);

    // Atomically increment team task counter if teamId is present
    if (body.teamId) {
      try {
        await Team.findByIdAndUpdate(body.teamId, {
          $inc: { totalTasksCount: 1 }
        });
        logger.info('📈 Team task counter incremented');
      } catch (error) {
        logger.error({ err: error }, '⚠️ Failed to increment team task counter:');
        // Don't fail the task creation if this fails
      }
    }

    // Revalidate project pages when task is created
    if (projectField) {
      revalidatePath(`/workspace/*/projects/${projectField}`);
      revalidatePath(`/workspace/*/projects/${projectField}/board`);
      revalidatePath(`/workspace/*/projects/${projectField}/tasks`);
      revalidatePath(`/workspace/*/projects/${projectField}/calendar`);
      revalidatePath(`/workspace/*/projects`); // Revalidate projects list
    }

    return successResponse(task, 'Task created');
  } catch (error) {
    return apiError(error, 'Failed to create task');
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    if (!rateLimit(ip)) {
      return Response.json(
        {
          message: 'Too many requests',
        },
        {
          status: 429,
        }
      );
    }

    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const sp = request.nextUrl.searchParams;
    const project = sp.get('project');
    const workspace = sp.get('workspace');

    // Opt-in pagination: only when the client passes page/limit.
    // Otherwise the legacy full-array response is preserved for
    // consumers that need complete datasets (Kanban, Calendar).
    let pagination = null;
    if (sp.has('page') || sp.has('limit')) {
      const parsed = parsePaginationParams(sp);
      if ('error' in parsed) {
        return errorResponse(parsed.error, 400);
      }
      pagination = parsed;
    }

    let tasks;

    if (project) {
      // IDOR: user must be a member of the project's workspace
      const membership = await getMembershipForProject(project, userId);
      if (!membership) {
        return errorResponse('Forbidden', 403);
      }
      tasks = pagination
        ? await getTasksPaginated(project, pagination)
        : await getTasks(project);
    } else if (workspace) {
      // IDOR: user must be a member of the workspace
      const membership = await getWorkspaceMembership(workspace, userId);
      if (!membership) {
        return errorResponse('Forbidden', 403);
      }
      tasks = pagination
        ? await getTasksByWorkspacePaginated(workspace, pagination)
        : await getTasksByWorkspace(workspace);
    } else {
      return errorResponse('Project or workspace required');
    }

    return successResponse(tasks);
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
